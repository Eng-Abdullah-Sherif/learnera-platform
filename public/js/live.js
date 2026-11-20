/**
 * Live streaming room.
 *
 * Media travels peer-to-peer (WebRTC); this script only exchanges the SDP/ICE
 * signalling with the server over a WebSocket. The room uses a star topology:
 * staff members (host / assigned instructor / coordinator / admin) are the
 * broadcasters, while students connect to the broadcasters and send their own
 * microphone upstream only once a staff member grants them permission.
 */
(function () {
  /** Shortcut to the shared translator. */
  const T = (key, vars) => (window.i18n ? i18n.t(key, vars) : key);
  if (window.i18n) {
    i18n.add({
      en: {
        live: {
          back: '← Back',
          liveBadge: 'LIVE',
          stageWaiting: 'Waiting for the presenter…',
          stageWaitingSub: 'The shared screen will appear here.',
          participants: 'Participants',
          micOn: 'Microphone',
          micOff: 'Microphone off',
          raiseHand: 'Raise hand',
          lowerHand: 'Lower hand',
          shareScreen: 'Share screen',
          stopSharing: 'Stop sharing',
          endSession: 'End session',
          leave: 'Leave',
          roleHost: 'Host',
          rolePresenter: 'Presenter',
          roleStudent: 'Student',
          endedTitle: 'Session ended',
          endedText: 'The host has ended this live session.',
          backToDashboard: 'Back to dashboard',
          disconnected: 'Connection lost',
          disconnectedText: 'You have been disconnected from the live session.',
          micError: 'Your microphone could not be started. You can still watch the session.',
          waitingPermission: 'Muted — raise your hand to ask to speak',
          granted: 'You can speak now',
          revoked: 'Your microphone was muted by the host',
          selfMute: 'Mute myself',
          selfMuted: 'Your microphone is now muted',
          autoMuted: 'Microphone muted automatically after you finished speaking',
          fullscreen: 'Full screen',
          exitFullscreen: 'Exit full screen',
          grant: 'Allow to speak',
          revoke: 'Mute',
          endConfirm: 'End the live session for everyone?',
          leaveConfirm: 'Leave the live session?',
          you: 'You',
          handUp: 'Hand raised',
          notAllowed: 'Only a staff member can do this.',
        },
      },
      ar: {
        live: {
          back: '← رجوع',
          liveBadge: 'مباشر',
          stageWaiting: 'في انتظار المُقدِّم…',
          stageWaitingSub: 'ستظهر الشاشة المشتركة هنا.',
          participants: 'المشاركون',
          micOn: 'الميكروفون',
          micOff: 'الميكروفون مغلق',
          raiseHand: 'رفع اليد',
          lowerHand: 'خفض اليد',
          shareScreen: 'مشاركة الشاشة',
          stopSharing: 'إيقاف المشاركة',
          endSession: 'إنهاء الجلسة',
          leave: 'مغادرة',
          roleHost: 'المُضيف',
          rolePresenter: 'المُقدِّم',
          roleStudent: 'طالب',
          endedTitle: 'انتهت الجلسة',
          endedText: 'أنهى المضيف هذه الجلسة المباشرة.',
          backToDashboard: 'العودة إلى لوحة التحكم',
          disconnected: 'انقطع الاتصال',
          disconnectedText: 'تم قطع اتصالك بالجلسة المباشرة.',
          micError: 'تعذّر تشغيل الميكروفون. لا يزال بإمكانك مشاهدة الجلسة.',
          waitingPermission: 'مكتوم — ارفع يدك لطلب التحدث',
          granted: 'يمكنك التحدث الآن',
          revoked: 'قام المضيف بكتم ميكروفونك',
          selfMute: 'كتم الميكروفون',
          selfMuted: 'تم كتم ميكروفونك',
          autoMuted: 'تم كتم الميكروفون تلقائياً بعد انتهاء حديثك',
          fullscreen: 'ملء الشاشة',
          exitFullscreen: 'خروج من ملء الشاشة',
          grant: 'السماح بالتحدث',
          revoke: 'كتم',
          endConfirm: 'إنهاء الجلسة المباشرة للجميع؟',
          leaveConfirm: 'مغادرة الجلسة المباشرة؟',
          you: 'أنت',
          handUp: 'رفع اليد',
          notAllowed: 'هذا الإجراء متاح لأحد أعضاء الفريق فقط.',
        },
      },
    });
  }

  const RTC_CONFIG = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };

  const sessionId = Number(window.location.pathname.split('/').filter(Boolean).pop());

  /* ------------------------------ state ------------------------------ */

  let me = null;
  let session = null;
  let access = { role: 'participant', canControl: false, canScreen: false };
  let selfPeerId = null;
  let ws = null;
  let hasJoined = false;

  const peers = new Map(); // peerId -> peer info
  const pcs = new Map(); // peerId -> RTCPeerConnection
  const pendingCandidates = new Map(); // peerId -> ICE candidates
  const remoteStreams = new Map(); // peerId -> MediaStream
  const audioEls = new Map(); // peerId -> HTMLAudioElement
  const videoSenders = new Map(); // peerId -> RTCRtpSender carrying the shared screen
  let stagePeerId = null; // peer currently shown on the stage

  let localAudioTrack = null;
  let screenTrack = null;
  let sharing = false;
  let handRaised = false;
  let myMicOn = false;

  // Auto-mute: watch the microphone level and release it after a moment of silence.
  const SILENCE_MS = 7000;
  const SPEECH_RMS = 0.02;
  let audioCtx = null;
  let analyser = null;
  let voiceTimer = null;
  let spokeSinceGrant = false;
  let lastVoiceAt = 0;

  /* ------------------------------ DOM ------------------------------ */

  const stageVideo = document.getElementById('stageVideo');
  const stageEmpty = document.getElementById('stageEmpty');
  const stageLabel = document.getElementById('stageLabel');
  const participantList = document.getElementById('participantList');
  const participantCount = document.getElementById('participantCount');
  const micBtn = document.getElementById('micBtn');
  const micIcon = document.getElementById('micIcon');
  const micLabel = document.getElementById('micLabel');
  const micHint = document.getElementById('micHint');
  const handBtn = document.getElementById('handBtn');
  const handLabel = document.getElementById('handLabel');
  const screenBtn = document.getElementById('screenBtn');
  const screenLabel = document.getElementById('screenLabel');
  const endBtn = document.getElementById('endBtn');
  const leaveBtn = document.getElementById('leaveBtn');
  const fullBtn = document.getElementById('fullBtn');
  const fullIcon = document.getElementById('fullIcon');
  const fullLabel = document.getElementById('fullLabel');
  const livePage = document.getElementById('livePage');
  const overlay = document.getElementById('liveOverlay');

  document.getElementById('logoutBtn').addEventListener('click', logout);

  /* ------------------------------ helpers ------------------------------ */

  function avatarHtml(peer) {
    if (peer.photo) return `<img src="${escapeHtml(peer.photo)}" alt="" />`;
    return `<span>${escapeHtml(initials(peer.name))}</span>`;
  }

  function peerById(id) {
    return peers.get(id) || null;
  }

  function setStage(peerId, stream) {
    stagePeerId = peerId;
    stageVideo.srcObject = stream;
    stageVideo.muted = true;
    stageVideo.play().catch(() => {});
    const peer = peerById(peerId);
    stageLabel.textContent = peer ? peer.name : '';
    stageLabel.style.display = peer ? '' : 'none';
    stageEmpty.style.display = 'none';
  }

  function clearStage() {
    stagePeerId = null;
    stageVideo.srcObject = null;
    stageLabel.style.display = 'none';
    stageEmpty.style.display = '';
  }

  function showOverlay(title, text) {
    document.getElementById('overlayTitle').textContent = title;
    document.getElementById('overlayText').textContent = text;
    overlay.style.display = 'flex';
  }

  function send(message) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  }

  function sendSignal(to, data) {
    send({ type: 'signal', to, data });
  }

  /* ------------------------------ rendering ------------------------------ */

  function allPeers() {
    return [...peers.values()];
  }

  function renderParticipants() {
    const list = allPeers();
    participantCount.textContent = String(list.length);

    participantList.innerHTML = list
      .map((peer) => {
        const isSelf = peer.id === selfPeerId;
        const flags = [];
        if (peer.hand) flags.push('<span class="live-flag hand" title="Hand raised">✋</span>');
        if (peer.publisher) {
          flags.push(peer.mic ? '<span class="live-flag mic on" title="Mic live">🎙️</span>' : '<span class="live-flag mic">🔇</span>');
          if (peer.sharing) flags.push('<span class="live-flag screen" title="Sharing screen">🖥️</span>');
        } else {
          flags.push(peer.mic ? '<span class="live-flag mic on" title="Mic live">🎙️</span>' : '<span class="live-flag mic">🔇</span>');
        }

        const roleChip = peer.publisher
          ? `<span class="live-role-chip sm">${escapeHtml(peer.canScreen ? T('live.rolePresenter') : T('live.roleHost'))}</span>`
          : '';

        // Host controls: grant / revoke a student's microphone.
        let actions = '';
        if (access.canControl && !peer.publisher && !isSelf) {
          actions = peer.mic
            ? `<button class="link-btn danger" data-action="revoke" data-peer="${peer.id}" type="button">${escapeHtml(T('live.revoke'))}</button>`
            : `<button class="link-btn" data-action="grant" data-peer="${peer.id}" type="button">${escapeHtml(T('live.grant'))}</button>`;
        }

        return `
          <div class="live-tile${isSelf ? ' self' : ''}">
            <div class="live-tile-avatar">${avatarHtml(peer)}</div>
            <div class="live-tile-main">
              <div class="live-tile-name">${escapeHtml(peer.name)}${isSelf ? ` <span class="live-you">(${escapeHtml(T('live.you'))})</span>` : ''}</div>
              <div class="live-tile-flags">${roleChip}${flags.join('')}</div>
            </div>
            <div class="live-tile-actions">${actions}</div>
          </div>`;
      })
      .join('');
  }

  /** True while this participant is allowed to speak (host grant still active). */
  function iCanSpeak() {
    if (access.canControl) return myMicOn;
    const selfPeer = peers.get(selfPeerId);
    return !!(selfPeer && selfPeer.mic);
  }

  function updateMicUi() {
    if (access.canControl) {
      micIcon.textContent = myMicOn ? '🎙️' : '🔇';
      micLabel.textContent = myMicOn ? T('live.micOn') : T('live.micOff');
      micBtn.classList.toggle('active', myMicOn);
      micHint.textContent = '';
    } else {
      const granted = iCanSpeak();
      micIcon.textContent = granted ? '🎙️' : '🔇';
      micLabel.textContent = granted ? T('live.selfMute') : T('live.micOff');
      micBtn.classList.toggle('active', granted);
      micHint.textContent = granted ? T('live.granted') : T('live.waitingPermission');
    }
    syncLocalTrack();
  }

  function syncLocalTrack() {
    if (!localAudioTrack) return;
    localAudioTrack.enabled = iCanSpeak();
  }

  function updateButtons() {
    handBtn.style.display = access.canControl ? 'none' : '';
    screenBtn.style.display = access.canScreen ? '' : 'none';
    endBtn.style.display = access.canControl ? '' : 'none';
    handLabel.textContent = handRaised ? T('live.lowerHand') : T('live.raiseHand');
    handBtn.classList.toggle('active', handRaised);
    screenLabel.textContent = sharing ? T('live.stopSharing') : T('live.shareScreen');
    screenBtn.classList.toggle('active', sharing);
  }

  /* ------------------------------ WebRTC ------------------------------ */

  /**
   * Optimises a sender for screen content (shared apps such as Excel).
   *
   * `maintain-resolution` keeps the text crisp instead of dropping detail when
   * bandwidth is tight, and the bitrate ceiling is raised so dense spreadsheets
   * do not turn into a blurry mess for the students.
   */
  async function tuneScreenSender(sender) {
    if (!sender) return;
    try {
      const params = sender.getParameters();
      if (!params.encodings || !params.encodings.length) params.encodings = [{}];
      params.encodings[0].maxBitrate = 3000000;
      params.encodings[0].maxFramerate = 30;
      params.encodings[0].priority = 'high';
      params.degradationPreference = 'maintain-resolution';
      await sender.setParameters(params);
    } catch {
      /* the browser may reject unsupported parameters - keep the defaults */
    }
  }

  function addLocalTracks(pc, peerId) {
    if (localAudioTrack) {
      try {
        pc.addTrack(localAudioTrack, new MediaStream([localAudioTrack]));
      } catch {
        /* ignore */
      }
    }
    // Reserve a single video slot per connection. Presenters send their screen on
    // it; everyone else only receives. Reusing one transceiver (instead of adding
    // a brand new one every time sharing toggles) avoids the extra m-line churn
    // that breaks the picture for some viewers.
    try {
      const senderOnly = access.canScreen;
      const transceiver = pc.addTransceiver('video', {
        direction: senderOnly ? 'sendonly' : 'recvonly',
      });
      videoSenders.set(peerId, transceiver.sender);
      if (senderOnly && screenTrack) {
        transceiver.sender.replaceTrack(screenTrack).then(() => tuneScreenSender(transceiver.sender)).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }

  function wirePc(pc, peerId) {
    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal(peerId, { candidate: e.candidate });
    };
    pc.ontrack = (e) => handleRemoteTrack(peerId, e.track, e.streams[0]);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        try {
          pc.restartIce();
        } catch {
          /* ignore */
        }
      }
    };
  }

  function handleRemoteTrack(peerId, track, stream) {
    let s = remoteStreams.get(peerId);
    if (!s) {
      s = new MediaStream();
      remoteStreams.set(peerId, s);
    }
    if (!s.getTracks().includes(track)) s.addTrack(track);

    if (track.kind === 'audio') {
      let el = audioEls.get(peerId);
      if (!el) {
        el = new Audio();
        el.autoplay = true;
        el.playsInline = true;
        audioEls.set(peerId, el);
        document.body.appendChild(el);
      }
      el.srcObject = s;
      el.play().catch(() => {});
    } else {
      setStage(peerId, s);
      const peer = peerById(peerId);
      if (peer) {
        peer.sharing = true;
        renderParticipants();
      }
    }

    track.onended = () => {
      if (track.kind === 'video' && stagePeerId === peerId) clearStage();
      const peer = peerById(peerId);
      if (peer && track.kind === 'video') {
        peer.sharing = false;
        renderParticipants();
      }
    };
  }

  /** Creates the (initiating) peer connection and sends the offer. */
  async function initiate(peerId) {
    if (pcs.has(peerId)) return;
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcs.set(peerId, pc);
    wirePc(pc, peerId);
    addLocalTracks(pc, peerId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal(peerId, { sdp: pc.localDescription });
    } catch {
      /* ignore */
    }
  }

  /** Answers an incoming offer (also used for renegotiation). */
  async function answerOffer(peerId, sdp) {
    let pc = pcs.get(peerId);
    if (!pc) {
      pc = new RTCPeerConnection(RTC_CONFIG);
      pcs.set(peerId, pc);
      wirePc(pc, peerId);
      addLocalTracks(pc, peerId);
    }
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      flushCandidates(peerId);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal(peerId, { sdp: pc.localDescription });
    } catch {
      /* ignore */
    }
  }

  /** Re-offers to a peer (used when local tracks change, e.g. screen share). */
  async function renegotiate(peerId) {
    const pc = pcs.get(peerId);
    if (!pc) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal(peerId, { sdp: pc.localDescription });
    } catch {
      /* ignore */
    }
  }

  function flushCandidates(peerId) {
    const pc = pcs.get(peerId);
    const list = pendingCandidates.get(peerId) || [];
    pendingCandidates.delete(peerId);
    if (!pc) return;
    for (const candidate of list) {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    }
  }

  async function onSignal(from, data) {
    if (!data) return;
    if (data.sdp) {
      if (data.sdp.type === 'offer') return answerOffer(from, data.sdp);
      if (data.sdp.type === 'answer') {
        const pc = pcs.get(from);
        if (!pc) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          flushCandidates(from);
        } catch {
          /* ignore */
        }
      }
      return;
    }
    if (data.candidate) {
      const pc = pcs.get(from);
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
      } else {
        if (!pendingCandidates.has(from)) pendingCandidates.set(from, []);
        pendingCandidates.get(from).push(data.candidate);
      }
    }
  }

  function dropPeer(peerId) {
    const pc = pcs.get(peerId);
    if (pc) {
      try {
        pc.close();
      } catch {
        /* ignore */
      }
      pcs.delete(peerId);
    }
    const el = audioEls.get(peerId);
    if (el) {
      el.srcObject = null;
      el.remove();
      audioEls.delete(peerId);
    }
    remoteStreams.delete(peerId);
    pendingCandidates.delete(peerId);
    videoSenders.delete(peerId);
    if (stagePeerId === peerId) clearStage();
    peers.delete(peerId);
    renderParticipants();
  }

  /* ------------------------------ server messages ------------------------------ */

  function handleJoined(msg) {
    hasJoined = true;
    selfPeerId = msg.self.id;
    session = msg.session;
    peers.clear();
    peers.set(msg.self.id, msg.self);

    for (const peer of msg.peers) {
      peers.set(peer.id, peer);
    }
    renderParticipants();

    // The newcomer initiates towards every broadcaster already in the room.
    for (const peer of msg.peers) {
      if (peer.id !== selfPeerId && peer.publisher) initiate(peer.id);
    }
  }

  function handlePeerJoined(peer) {
    peers.set(peer.id, peer);
    renderParticipants();
    // A student connects to a broadcaster that just arrived.
    if (!access.canControl && peer.publisher && peer.id !== selfPeerId) {
      initiate(peer.id);
    }
  }

  function handleMessage(msg) {
    switch (msg.type) {
      case 'ready':
        break;
      case 'joined':
        handleJoined(msg);
        break;
      case 'peer-joined':
        handlePeerJoined(msg.peer);
        break;
      case 'peer-left':
        dropPeer(msg.id);
        break;
      case 'signal':
        onSignal(msg.from, msg.data);
        break;
      case 'hand': {
        const peer = peerById(msg.peerId);
        if (peer) {
          peer.hand = !!msg.raised;
          renderParticipants();
        }
        break;
      }
      case 'mic': {
        const peer = peerById(msg.peerId);
        if (peer) peer.mic = !!msg.granted;
        if (msg.peerId === selfPeerId) {
          if (msg.granted) {
            toast(T('live.granted'));
            // A fresh grant: reset the silence tracker and make sure the audio
            // graph is running so the auto-mute can arm itself.
            spokeSinceGrant = false;
            lastVoiceAt = 0;
            resumeAudioGraph();
          } else if (msg.by === 'self') {
            toast(T('live.selfMuted'));
          } else {
            toast(T('live.revoked'));
          }
          updateMicUi();
        }
        renderParticipants();
        break;
      }
      case 'host-mic': {
        const peer = peerById(msg.peerId);
        if (peer) {
          peer.mic = !!msg.on;
          renderParticipants();
        }
        break;
      }
      case 'screen': {
        const peer = peerById(msg.peerId);
        if (peer) {
          peer.sharing = !!msg.sharing;
          if (!msg.sharing && stagePeerId === msg.peerId) clearStage();
          renderParticipants();
        }
        break;
      }
      case 'ended':
        showOverlay(T('live.endedTitle'), T('live.endedText'));
        break;
      case 'error':
        toast(msg.message || T('live.notAllowed'), true);
        break;
      default:
        break;
    }
  }

  /* ------------------------------ connection ------------------------------ */

  function connect() {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${window.location.host}/ws/live`);

    ws.onopen = () => send({ type: 'join', sessionId });
    ws.onmessage = (event) => {
      let msg = null;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      handleMessage(msg);
    };
    ws.onclose = () => {
      if (overlay.style.display !== 'flex') {
        showOverlay(T('live.disconnected'), T('live.disconnectedText'));
      }
    };
  }

  /* ------------------------------ microphone / screen ------------------------------ */

  async function initAudio() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localAudioTrack = stream.getAudioTracks()[0];
      myMicOn = access.canControl;
      syncLocalTrack();
      startVoiceWatch(stream);
    } catch {
      toast(T('live.micError'), true);
    }
  }

  /* --- automatic self-mute: release the microphone once the student is done --- */

  /** Resumes the WebAudio graph (browsers suspend it until a user gesture). */
  function resumeAudioGraph() {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  }

  /** Arms the silence detector used to auto-mute a student after they speak. */
  function startVoiceWatch(stream) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      audioCtx = new Ctx();
      const source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
    } catch {
      analyser = null;
      return;
    }
    resumeAudioGraph();
    const data = new Uint8Array(analyser.fftSize);
    voiceTimer = setInterval(() => {
      if (!analyser) return;
      // Only track students who currently hold the microphone.
      if (access.canControl || !iCanSpeak() || !localAudioTrack || !localAudioTrack.enabled) {
        spokeSinceGrant = false;
        lastVoiceAt = 0;
        return;
      }
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const now = Date.now();
      if (rms > SPEECH_RMS) {
        spokeSinceGrant = true;
        lastVoiceAt = now;
      } else if (spokeSinceGrant && now - lastVoiceAt >= SILENCE_MS) {
        // The student finished talking - release the microphone on their behalf.
        spokeSinceGrant = false;
        releaseMic();
        toast(T('live.autoMuted'));
      }
    }, 500);
  }

  /** The student mutes their own microphone (manual button or auto-mute). */
  function releaseMic() {
    const selfPeer = peers.get(selfPeerId);
    if (selfPeer) selfPeer.mic = false;
    send({ type: 'self-mic', on: false });
    updateMicUi();
    renderParticipants();
  }

  /* ------------------------------ screen sharing ------------------------------ */

  async function toggleScreen() {
    if (sharing) return stopScreen();
    let stream;
    try {
      // Ask for a crisp, high-resolution capture so shared apps (Excel, slides…)
      // stay legible for every viewer.
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 15, max: 30 },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
    } catch {
      return; // the user cancelled the picker
    }
    screenTrack = stream.getVideoTracks()[0];
    // Hint the encoder that this is text/detail-heavy content. Without it the
    // browser treats the screen like a camera and blurs fine text (e.g. Excel
    // cells) when the bitrate dips.
    if ('contentHint' in screenTrack) screenTrack.contentHint = 'text';
    sharing = true;
    screenTrack.onended = () => stopScreen();
    send({ type: 'screen', sharing: true });
    updateButtons();

    for (const [peerId, pc] of pcs) {
      let sender = videoSenders.get(peerId);
      if (!sender) {
        // Fallback for connections created before the slot was reserved.
        const transceiver = pc.addTransceiver('video', { direction: 'sendonly' });
        sender = transceiver.sender;
        videoSenders.set(peerId, sender);
      }
      try {
        await sender.replaceTrack(screenTrack);
        await tuneScreenSender(sender);
      } catch {
        /* ignore */
      }
      renegotiate(peerId);
    }
    // Show the presenter their own screen.
    setStage(selfPeerId, stream);
    const selfPeer = peers.get(selfPeerId);
    if (selfPeer) {
      selfPeer.sharing = true;
      renderParticipants();
    }
  }

  function stopScreen() {
    const track = screenTrack;
    sharing = false;
    for (const [peerId] of pcs) {
      const sender = videoSenders.get(peerId);
      if (sender) {
        try {
          sender.replaceTrack(null);
        } catch {
          /* ignore */
        }
      }
      renegotiate(peerId);
    }
    if (track) track.stop();
    screenTrack = null;
    if (stagePeerId === selfPeerId) clearStage();
    const selfPeer = peers.get(selfPeerId);
    if (selfPeer) {
      selfPeer.sharing = false;
      renderParticipants();
    }
    send({ type: 'screen', sharing: false });
    updateButtons();
  }

  /* ------------------------------ events ------------------------------ */

  micBtn.addEventListener('click', () => {
    resumeAudioGraph();
    if (access.canControl) {
      myMicOn = !myMicOn;
      send({ type: 'host-mic', on: myMicOn });
      updateMicUi();
      return;
    }
    // Students: after the host grants the microphone they may mute themselves
    // once they are done speaking - no extra action from the host required.
    if (iCanSpeak()) {
      releaseMic();
    } else {
      toast(T('live.waitingPermission'));
    }
  });

  handBtn.addEventListener('click', () => {
    handRaised = !handRaised;
    send({ type: 'hand', raised: handRaised });
    const selfPeer = peers.get(selfPeerId);
    if (selfPeer) selfPeer.hand = handRaised;
    updateButtons();
    renderParticipants();
  });

  screenBtn.addEventListener('click', toggleScreen);

  /* ------------------------------ full screen ------------------------------ */

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function updateFullscreenUi() {
    const on = !!fullscreenElement();
    fullIcon.textContent = on ? '⤢' : '⛶';
    fullLabel.textContent = on ? T('live.exitFullscreen') : T('live.fullscreen');
    fullBtn.classList.toggle('active', on);
  }

  async function toggleFullscreen() {
    try {
      if (!fullscreenElement()) {
        const el = livePage || document.documentElement;
        const request = el.requestFullscreen || el.webkitRequestFullscreen;
        if (request) await request.call(el);
      } else {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) await exit.call(document);
      }
    } catch {
      /* some browsers block full screen without a direct user gesture */
    }
    updateFullscreenUi();
  }

  fullBtn.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', updateFullscreenUi);
  document.addEventListener('webkitfullscreenchange', updateFullscreenUi);

  endBtn.addEventListener('click', () => {
    if (!window.confirm(T('live.endConfirm'))) return;
    send({ type: 'end' });
  });

  leaveBtn.addEventListener('click', () => {
    if (sharing) stopScreen();
    send({ type: 'leave' });
    if (ws) ws.close();
    window.location.href = backPath();
  });

  participantList.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;
    const peerId = btn.dataset.peer;
    if (btn.dataset.action === 'grant') send({ type: 'grant-mic', peerId });
    else if (btn.dataset.action === 'revoke') send({ type: 'revoke-mic', peerId });
  });

  window.addEventListener('beforeunload', () => {
    try {
      if (voiceTimer) clearInterval(voiceTimer);
      if (audioCtx && audioCtx.close) audioCtx.close();
      if (sharing) stopScreen();
      send({ type: 'leave' });
    } catch {
      /* ignore */
    }
  });

  function backPath() {
    if (me && me.role === 'admin') return '/admin';
    if (me && me.role === 'instructor') return '/instructor';
    if (me && me.role === 'coordinator') return '/coordinator';
    return '/dashboard';
  }

  /* ------------------------------ init ------------------------------ */

  if (window.i18n) {
    i18n.onChange(() => {
      renderParticipants();
      updateButtons();
      updateMicUi();
      updateFullscreenUi();
    });
  }

  (async function init() {
    me = await loadCurrentUser();
    if (!me) return;

    document.getElementById('topName').textContent = me.name || me.email;
    document.getElementById('topRole').textContent = roleLabel(me.role);
    document.getElementById('backLink').href = backPath();
    document.getElementById('overlayBack').href = backPath();

    try {
      const data = await api(`/api/live/${sessionId}`);
      session = data.session;
      access = { role: data.role, canControl: !!data.canControl, canScreen: !!data.canScreen };
    } catch (err) {
      showOverlay(T('live.endedTitle'), err.message);
      return;
    }

    document.getElementById('liveTitle').textContent = session.title || session.course || 'Live session';
    document.getElementById('liveCourse').textContent = session.course || '';
    document.getElementById('liveHost').textContent = session.host || '';
    document.getElementById('myRoleChip').textContent = access.canControl
      ? T('live.roleHost')
      : T('live.roleStudent');

    if (session.status !== 'live') {
      showOverlay(T('live.endedTitle'), T('live.endedText'));
      updateButtons();
      updateFullscreenUi();
      return;
    }

    updateButtons();
    updateFullscreenUi();
    await initAudio();
    updateMicUi();
    connect();
  })();
})();
