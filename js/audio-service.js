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
        if (osc.frequency && osc.frequency.cancelScheduledValues) {
          osc.frequency.cancelScheduledValues(0);
        }
        osc.stop(0);
        osc.disconnect();
      } catch (e) {}
    });
    this.activeOscillators = [];

    this.activeGainNodes.forEach((gain) => {
      try {
        if (gain.gain && gain.gain.cancelScheduledValues) {
          gain.gain.cancelScheduledValues(0);
        }
        if (this.audioCtx) {
          gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
        }
        gain.disconnect();
      } catch (e) {}
    });
    this.activeGainNodes = [];

    try {
      const allAudios = document.querySelectorAll('audio');
      allAudios.forEach(a => { a.pause(); a.currentTime = 0; });
    } catch(e) {}
  }

  /**
   * Reproduce la alarma sonora de alta fidelidad de acuerdo al tipo de cooperación solicitada.
   * Utiliza programación limpia con cancelación de rampas previas para evitar distorsiones o crujidos.
   * @param {'colaboracion'|'cooperacion'|'guardia'} type
   */
  playAlarm(type) {
    this.stopAlarm();
    this.initContext();
    if (!this.audioCtx) return;

    this.isPlaying = true;

    // Filtro pasa-bajos suave para eliminar asperezas digitales y sonar nítido en altavoces de celular
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, this.audioCtx.currentTime);
    filter.connect(this.audioCtx.destination);

    if (type === 'cooperacion') {
      // 🔴 COOPERACIÓN (Apoyo Policial Urgente / Máxima Prioridad)
      // Sirena policial "Wail/Yelp" de doble oscilador
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'triangle';

      gain.gain.setValueAtTime(0.35, this.audioCtx.currentTime);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(filter);

      osc1.start();
      osc2.start();

      this.activeOscillators.push(osc1, osc2);
      this.activeGainNodes.push(gain);

      const cycleDuration = 0.6; // 600ms por ciclo
      const scheduleCycle = () => {
        if (!this.isPlaying || !this.audioCtx) return;
        const now = this.audioCtx.currentTime;

        // Cancelar cualquier valor previo para evitar solapamiento o distorsión
        osc1.frequency.cancelScheduledValues(now);
        osc2.frequency.cancelScheduledValues(now);

        osc1.frequency.setValueAtTime(650, now);
        osc1.frequency.exponentialRampToValueAtTime(1450, now + cycleDuration * 0.5);
        osc1.frequency.exponentialRampToValueAtTime(650, now + cycleDuration);

        osc2.frequency.setValueAtTime(325, now);
        osc2.frequency.exponentialRampToValueAtTime(725, now + cycleDuration * 0.5);
        osc2.frequency.exponentialRampToValueAtTime(325, now + cycleDuration);
      };

      scheduleCycle();
      this.alarmInterval = setInterval(scheduleCycle, cycleDuration * 1000);

    } else if (type === 'colaboracion') {
      // 🟡 COLABORACIÓN (Apoyo Policial Controlado)
      // Sirena policial Hi-Lo Sweep
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'triangle';

      gain.gain.setValueAtTime(0.35, this.audioCtx.currentTime);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(filter);

      osc1.start();
      osc2.start();

      this.activeOscillators.push(osc1, osc2);
      this.activeGainNodes.push(gain);

      const cycleDuration = 0.9; // 900ms por ciclo
      const scheduleCycle = () => {
        if (!this.isPlaying || !this.audioCtx) return;
        const now = this.audioCtx.currentTime;

        osc1.frequency.cancelScheduledValues(now);
        osc2.frequency.cancelScheduledValues(now);

        osc1.frequency.setValueAtTime(550, now);
        osc1.frequency.exponentialRampToValueAtTime(1300, now + cycleDuration * 0.5);
        osc1.frequency.exponentialRampToValueAtTime(550, now + cycleDuration);

        osc2.frequency.setValueAtTime(275, now);
        osc2.frequency.exponentialRampToValueAtTime(650, now + cycleDuration * 0.5);
        osc2.frequency.exponentialRampToValueAtTime(275, now + cycleDuration);
      };

      scheduleCycle();
      this.alarmInterval = setInterval(scheduleCycle, cycleDuration * 1000);

    } else if (type === 'guardia') {
      // 🔵 COOPERACIÓN SERVICIO DE GUARDIA (Apoyo en Dependencias)
      // Tono policial bi-tono alternado cristalino
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      gain.gain.setValueAtTime(0.4, this.audioCtx.currentTime);

      osc.connect(gain);
      gain.connect(filter);
      osc.start();

      this.activeOscillators.push(osc);
      this.activeGainNodes.push(gain);

      const step = 0.3; // 300ms cada tono
      const scheduleCycle = () => {
        if (!this.isPlaying || !this.audioCtx) return;
        const now = this.audioCtx.currentTime;

        osc.frequency.cancelScheduledValues(now);
        osc.frequency.setValueAtTime(784, now);        // G5 (Tono alto)
        osc.frequency.setValueAtTime(659, now + step); // E5 (Tono bajo)
      };

      scheduleCycle();
      this.alarmInterval = setInterval(scheduleCycle, step * 2000);
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
