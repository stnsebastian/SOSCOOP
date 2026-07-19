/**
 * AudioService - SOSCOOP
 * Maneja la síntesis nativa de sirenas y balizas vía Web Audio API y
 * la grabación de notas de voz PTT (Push-To-Talk) mediante MediaRecorder API.
 */

class AudioService {
  constructor() {
    this.audioCtx = null;
    this.activeOscillators = [];
    this.activeGainNodes = [];
    this.alarmInterval = null;
    this.isPlaying = false;

    // Grabación de voz PTT
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.mediaStream = null;
    this.recordingStartTime = null;
  }

  /**
   * Inicializa AudioContext ante la primera acción del usuario para cumplir
   * con las políticas de auto-reproducción de navegadores móviles.
   */
  initContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /**
   * Detiene inmediatamente cualquier baliza o sirena en curso.
   */
  _clearActiveNodes() {
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }

    if (this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.activeGainNodes.forEach((gain) => {
        try {
          if (gain.gain && typeof gain.gain.cancelScheduledValues === 'function') {
            gain.gain.cancelScheduledValues(now);
          }
          if (gain.gain) {
            gain.gain.setValueAtTime(0, now);
          }
          gain.disconnect();
        } catch (e) {}
      });
    }
    this.activeGainNodes = [];

    this.activeOscillators.forEach((osc) => {
      try {
        if (osc.frequency && typeof osc.frequency.cancelScheduledValues === 'function' && this.audioCtx) {
          osc.frequency.cancelScheduledValues(this.audioCtx.currentTime);
        }
        osc.stop();
        osc.disconnect();
      } catch (e) {}
    });
    this.activeOscillators = [];
  }

  stopAlarm() {
    this.isPlaying = false;
    this._clearActiveNodes();

    // Pausar elementos HTML5 por si hubieran audios o notas en curso
    try {
      const allAudios = document.querySelectorAll('audio');
      allAudios.forEach(a => { a.pause(); a.currentTime = 0; });
    } catch(e) {}

    if (this.audioCtx && this.audioCtx.state === 'running') {
      try {
        this.audioCtx.suspend();
      } catch (e) {}
    }
  }

  /**
   * Reproduce la alarma sonora de alta fidelidad utilizando modulación continua nativa por LFO (Hardware C++ del navegador).
   * Elimina completamente el uso de temporizadores JavaScript en bucle (setInterval), evitando 100% las distorsiones,
   * saltos de frecuencia y permitiendo un corte inmediato y limpio al presionar detener.
   * @param {'colaboracion'|'cooperacion'|'guardia'} type
   */
  playAlarm(type) {
    this._clearActiveNodes();
    this.initContext();
    if (!this.audioCtx) return;

    this.isPlaying = true;

    // Filtro pasa-bajos suave para eliminar armónicos agudos y sonar nítido en altavoces de celular
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, this.audioCtx.currentTime);
    filter.connect(this.audioCtx.destination);

    // Nodo de ganancia maestro del ciclo
    const masterGain = this.audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.35, this.audioCtx.currentTime);
    masterGain.connect(filter);
    this.activeGainNodes.push(masterGain);

    if (type === 'cooperacion') {
      // 🔴 COOPERACIÓN URGENTE (Apoyo Policial Inmediato / Máxima Prioridad)
      // Modulación por LFO nativo tipo "Wail/Yelp" rápido (1.6 Hz, barrido entre 650Hz y 1450Hz)
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator(); // Sub-tono de cuerpo para celular
      const lfo = this.audioCtx.createOscillator();
      const lfoGain = this.audioCtx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1050, this.audioCtx.currentTime);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(525, this.audioCtx.currentTime);

      lfo.type = 'triangle';
      lfo.frequency.setValueAtTime(1.6, this.audioCtx.currentTime); // 1.6 oscilaciones por segundo
      lfoGain.gain.setValueAtTime(400, this.audioCtx.currentTime);  // ±400 Hz de variación de tono

      // Conectar LFO directamente al control de frecuencia de los osciladores
      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);
      
      const lfoGainSub = this.audioCtx.createGain();
      lfoGainSub.gain.setValueAtTime(200, this.audioCtx.currentTime);
      lfo.connect(lfoGainSub);
      lfoGainSub.connect(osc2.frequency);

      osc1.connect(masterGain);
      osc2.connect(masterGain);

      osc1.start();
      osc2.start();
      lfo.start();

      this.activeOscillators.push(osc1, osc2, lfo);
      this.activeGainNodes.push(lfoGain, lfoGainSub);

    } else if (type === 'colaboracion') {
      // 🟡 COLABORACIÓN (Apoyo Policial Controlado)
      // Modulación por LFO nativo tipo "Hi-Lo Sweep" suave y distinguible (0.8 Hz, barrido 550Hz a 1300Hz)
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const lfo = this.audioCtx.createOscillator();
      const lfoGain = this.audioCtx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(925, this.audioCtx.currentTime);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(462, this.audioCtx.currentTime);

      lfo.type = 'triangle';
      lfo.frequency.setValueAtTime(0.8, this.audioCtx.currentTime); // Más pausado
      lfoGain.gain.setValueAtTime(375, this.audioCtx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);

      const lfoGainSub = this.audioCtx.createGain();
      lfoGainSub.gain.setValueAtTime(187, this.audioCtx.currentTime);
      lfo.connect(lfoGainSub);
      lfoGainSub.connect(osc2.frequency);

      osc1.connect(masterGain);
      osc2.connect(masterGain);

      osc1.start();
      osc2.start();
      lfo.start();

      this.activeOscillators.push(osc1, osc2, lfo);
      this.activeGainNodes.push(lfoGain, lfoGainSub);

    } else if (type === 'guardia') {
      // 🔵 COOPERACIÓN SERVICIO DE GUARDIA (Apoyo en Dependencia)
      // Modulación por LFO de onda cuadrada tipo Despacho Europeo alternado (Hi-Lo alternado puro)
      const osc = this.audioCtx.createOscillator();
      const lfo = this.audioCtx.createOscillator();
      const lfoGain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(721.5, this.audioCtx.currentTime); // Centro entre 784Hz y 659Hz

      lfo.type = 'square';
      lfo.frequency.setValueAtTime(1.6, this.audioCtx.currentTime);   // Alternancia limpia cada ~312ms
      lfoGain.gain.setValueAtTime(62.5, this.audioCtx.currentTime);   // +62.5 = 784Hz, -62.5 = 659Hz

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      osc.connect(masterGain);
      osc.start();
      lfo.start();

      this.activeOscillators.push(osc, lfo);
      this.activeGainNodes.push(lfoGain);
    }
  }

  /**
   * Reproduce un audio o efecto de confirmación al presionar botones.
   */
  playTacticalClick() {
    this.initContext();
    if (!this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.05);
    } catch (e) {}
  }

  /**
   * Inicia la grabación de micrófono (PTT)
   * @returns {Promise<boolean>} éxito o fallo al solicitar permisos
   */
  async startRecording() {
    try {
      this.audioChunks = [];
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
        else mimeType = '';
      }

      this.mediaRecorder = mimeType ? new MediaRecorder(this.mediaStream, { mimeType }) : new MediaRecorder(this.mediaStream);
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.recordingStartTime = Date.now();
      this.mediaRecorder.start();
      this.playTacticalClick();
      return true;
    } catch (error) {
      console.warn('[AudioService] Error al obtener micrófono:', error);
      alert('⚠️ No se pudo acceder al micrófono. Verifica los permisos del navegador en tu celular.');
      return false;
    }
  }

  /**
   * Detiene la grabación y retorna el audio codificado en Base64 para adjuntar al mensaje de alerta.
   * @returns {Promise<{base64Url: string, blob: Blob, durationSec: number}|null>}
   */
  async stopRecording() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = async () => {
        const durationSec = Math.max(1, Math.round((Date.now() - (this.recordingStartTime || Date.now())) / 1000));
        const blob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType || 'audio/webm' });
        
        // Detener pistas de stream
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach(track => track.stop());
        }

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          resolve({
            base64Url: reader.result,
            blob: blob,
            durationSec: durationSec
          });
        };
      };

      this.mediaRecorder.stop();
      this.playTacticalClick();
    });
  }

  /**
   * Reproduce un audio codificado en Base64 o URL
   * @param {string} audioUrl
   */
  playAudioNote(audioUrl) {
    if (!audioUrl) return;
    try {
      const audio = new Audio(audioUrl);
      audio.play().catch(err => console.warn('No se pudo reproducir nota de voz:', err));
    } catch (e) {}
  }
}

// Instancia global
window.audioService = new AudioService();
