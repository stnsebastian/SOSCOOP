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
  stopAlarm() {
    this.isPlaying = false;
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
    this.activeOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {}
    });
    this.activeOscillators = [];

    this.activeGainNodes.forEach((gain) => {
      try { gain.disconnect(); } catch (e) {}
    });
    this.activeGainNodes = [];
  }

  /**
   * Reproduce la alarma sonora de acuerdo al tipo de cooperación solicitada.
   * @param {'colaboracion'|'cooperacion'|'guardia'} type
   */
  playAlarm(type) {
    this.stopAlarm();
    this.initContext();
    if (!this.audioCtx) return;

    this.isPlaying = true;

    if (type === 'cooperacion') {
      // 🔴 COOPERACIÓN (Apoyo Policial Urgente / Máxima Prioridad)
      // Sirena tipo Wail/Yelp penetrante policial (oscilación continua entre 600Hz y 1400Hz)
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sawtooth';
      
      gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();

      this.activeOscillators.push(osc);
      this.activeGainNodes.push(gain);

      let up = true;
      let freq = 600;
      this.alarmInterval = setInterval(() => {
        if (!this.isPlaying) return;
        if (up) {
          freq += 80;
          if (freq >= 1450) up = false;
        } else {
          freq -= 80;
          if (freq <= 600) up = true;
        }
        if (osc && this.audioCtx) {
          osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        }
      }, 35);

    } else if (type === 'colaboracion') {
      // 🟡 COLABORACIÓN (Situación Controlada / Apoyo Policial)
      // Sirena policial tipo Sweep / Hi-Lo (Muy similar a la alarma roja pero en frecuencia 550Hz-1250Hz y ritmo 45ms)
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sawtooth';
      
      gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();

      this.activeOscillators.push(osc);
      this.activeGainNodes.push(gain);

      let up = true;
      let freq = 550;
      this.alarmInterval = setInterval(() => {
        if (!this.isPlaying) return;
        if (up) {
          freq += 60;
          if (freq >= 1250) up = false;
        } else {
          freq -= 60;
          if (freq <= 550) up = true;
        }
        if (osc && this.audioCtx) {
          osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        }
      }, 45);

    } else if (type === 'guardia') {
      // 🔵 COOPERACIÓN SERVICIO DE GUARDIA (Apoyo en Dependencias)
      // Alarma electrónica policial tipo Phaser / Interceptor electrónico (Modulación rápida en onda cuadrada de 900Hz-1650Hz cada 18ms)
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'square';
      
      gain.gain.setValueAtTime(0.25, this.audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();

      this.activeOscillators.push(osc);
      this.activeGainNodes.push(gain);

      let freq = 900;
      let step = 110;
      this.alarmInterval = setInterval(() => {
        if (!this.isPlaying) return;
        freq += step;
        if (freq > 1650 || freq < 900) {
          step = -step;
        }
        if (osc && this.audioCtx) {
          osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        }
      }, 18);
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
