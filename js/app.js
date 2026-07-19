/**
 * App.js - SOSCOOP Controller
 * Controlador principal de la PWA táctica de emergencias policiales.
 */

class AppController {
  constructor() {
    this.currentUser = null;
    this.currentAudioNote = null; // { base64Url, durationSec }
    this.isRecordingPTT = false;
    this.activeStrobeAlert = null;
    this.isWhatsAppEnabled = localStorage.getItem('soscoop_whatsapp_enabled') === 'true';
    this.lastAlertSentOrReceived = null;
  }

  init() {
    console.log('[SOSCOOP] Inicializando aplicación PWA');
    this.cacheDOM();
    this.bindEvents();
    this.checkSession();
    this.setupNetworkListeners();
    this.renderAlertsFeed();
  }

  cacheDOM() {
    // Pantallas
    this.loginView = document.getElementById('login-view');
    this.dashboardView = document.getElementById('dashboard-view');
    this.feedView = document.getElementById('feed-view');
    this.strobeModal = document.getElementById('strobe-modal');

    // Formulario Ingreso
    this.loginForm = document.getElementById('login-form');
    this.firstNameInput = document.getElementById('input-firstname');
    this.surnamesInput = document.getElementById('input-surnames');

    // Display Operador
    this.operatorDisplayName = document.getElementById('operator-display-name');
    this.btnLogout = document.getElementById('btn-logout');

    // Botones de Emergencia
    this.btnColaboracion = document.getElementById('btn-sos-colaboracion');
    this.btnCooperacion = document.getElementById('btn-sos-cooperacion');
    this.btnGuardia = document.getElementById('btn-sos-guardia');

    // Grabador PTT
    this.btnPTT = document.getElementById('btn-ptt');
    this.pttText = document.getElementById('ptt-text');
    this.audioPreviewContainer = document.getElementById('audio-preview-container');
    this.audioPlayerElem = document.getElementById('ptt-audio-player');
    this.btnDiscardAudio = document.getElementById('btn-discard-audio');

    // Navegación inferior
    this.navButtons = document.querySelectorAll('.nav-item');
    this.navBadge = document.getElementById('nav-feed-badge');

    // Feed Central
    this.feedContainer = document.getElementById('alerts-feed-list');
    this.btnSimulate = document.getElementById('btn-simulate');
    this.btnClearFeed = document.getElementById('btn-clear-feed');

    // Strobe Modal elementos
    this.strobeContentCard = document.getElementById('strobe-content-card');
    this.strobeIconBadge = document.getElementById('strobe-icon-badge');
    this.strobeTitle = document.getElementById('strobe-title');
    this.strobeCallerName = document.getElementById('strobe-caller-name');
    this.strobeLocationText = document.getElementById('strobe-location-text');
    this.btnStopAlarm = document.getElementById('btn-stop-alarm');

    // WhatsApp elementos opcionales
    this.loginWhatsappToggle = document.getElementById('login-whatsapp-toggle');
    this.dashboardWhatsappToggle = document.getElementById('dashboard-whatsapp-toggle');
    this.btnWhatsappResend = document.getElementById('btn-whatsapp-resend');
  }

  bindEvents() {
    // Formateo automático de nombre en tiempo real
    this.firstNameInput.addEventListener('input', (e) => {
      const formatted = this.formatFirstName(e.target.value);
      if (e.target.value !== formatted) {
        const pos = e.target.selectionStart;
        e.target.value = formatted;
        e.target.setSelectionRange(pos, pos);
      }
    });

    // Formateo automático de apellidos a mayúscula en tiempo real
    this.surnamesInput.addEventListener('input', (e) => {
      const formatted = e.target.value.toUpperCase();
      if (e.target.value !== formatted) {
        const pos = e.target.selectionStart;
        e.target.value = formatted;
        e.target.setSelectionRange(pos, pos);
      }
    });

    // Envío del login
    this.loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const first = this.formatFirstName(this.firstNameInput.value.trim());
      const surnames = this.surnamesInput.value.trim().toUpperCase();

      if (!first || !surnames) {
        alert('Por favor ingresa el nombre y los dos apellidos para el registro operativo.');
        return;
      }

      const fullName = `${first} ${surnames}`;
      this.loginUser({ firstName: first, surnames: surnames, fullName: fullName });
    });

    // Cerrar sesión
    this.btnLogout.addEventListener('click', () => this.logoutUser());

    // Botones de Emergencia (3 Tipos)
    this.btnColaboracion.addEventListener('click', () => this.triggerEmergency('colaboracion'));
    this.btnCooperacion.addEventListener('click', () => this.triggerEmergency('cooperacion'));
    this.btnGuardia.addEventListener('click', () => this.triggerEmergency('guardia'));

    // PTT Grabador (Soporte Touch y Click para móvil y escritorio)
    this.btnPTT.addEventListener('click', () => this.togglePTT());

    this.btnDiscardAudio.addEventListener('click', () => {
      this.currentAudioNote = null;
      this.audioPreviewContainer.classList.add('hidden');
      this.audioPlayerElem.src = '';
    });

    // Navegación Inferior
    this.navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const viewName = btn.getAttribute('data-view');
        this.showView(viewName);
      });
    });

    // Simulación de alertas entrantes
    this.btnSimulate.addEventListener('click', () => {
      window.networkService.simulateIncomingAlert();
    });

    // Limpiar historial del radar de emergencias
    if (this.btnClearFeed) {
      this.btnClearFeed.addEventListener('click', () => {
        if (confirm('¿Confirmas que deseas limpiar todos los registros de emergencias en el radar?')) {
          window.networkService.clearHistory();
          this.renderAlertsFeed();
          if (this.navBadge) {
            this.navBadge.classList.add('hidden');
          }
        }
      });
    }

    // Preferencia opcional de envío automático a WhatsApp
    if (this.loginWhatsappToggle) {
      this.loginWhatsappToggle.checked = this.isWhatsAppEnabled;
      this.loginWhatsappToggle.addEventListener('change', (e) => {
        this.updateWhatsAppPreference(e.target.checked);
      });
    }
    if (this.dashboardWhatsappToggle) {
      this.dashboardWhatsappToggle.checked = this.isWhatsAppEnabled;
      this.dashboardWhatsappToggle.addEventListener('change', (e) => {
        this.updateWhatsAppPreference(e.target.checked);
      });
    }
    if (this.btnWhatsappResend) {
      this.btnWhatsappResend.addEventListener('click', () => {
        if (this.lastAlertSentOrReceived) {
          const { alertType, operatorName, location } = this.lastAlertSentOrReceived;
          this.sendToWhatsApp(alertType, location, operatorName);
        }
      });
    }

    // Detener alarma desde el Modal Estroboscópico
    this.btnStopAlarm.addEventListener('click', () => {
      window.audioService.stopAlarm();
      this.strobeModal.classList.add('hidden');
      this.strobeModal.className = 'strobe-modal hidden';
      this.activeStrobeAlert = null;
    });
  }

  updateWhatsAppPreference(checked) {
    this.isWhatsAppEnabled = checked;
    localStorage.setItem('soscoop_whatsapp_enabled', checked ? 'true' : 'false');
    if (this.loginWhatsappToggle) this.loginWhatsappToggle.checked = checked;
    if (this.dashboardWhatsappToggle) this.dashboardWhatsappToggle.checked = checked;
    window.audioService.playTacticalClick();
  }

  /**
   * Envía la alerta en formato texto al WhatsApp para compartir en el Grupo BICRIM SAN JAVIER.
   */
  sendToWhatsApp(alertType, location, operatorName) {
    let typeHeader = '🟡 COLABORACIÓN POLICIAL (Situación Controlada / Apoyo)';
    if (alertType === 'cooperacion') typeHeader = '🔴 COOPERACIÓN URGENTE (Apoyo Policial Inmediato)';
    if (alertType === 'guardia') typeHeader = '🔵 COOPERACIÓN SERVICIO DE GUARDIA (Apoyo en Dependencia)';

    let msg = `🚨 *ALERTA SOSCOOP - BICRIM SAN JAVIER* 🚨\n\n`;
    msg += `*Tipo de Alerta:* ${typeHeader}\n`;
    msg += `*Funcionario:* ${operatorName || (this.currentUser ? this.currentUser.fullName : 'Operador Policial')}\n`;
    
    if (location && !location.isGuardia && location.lat && location.lng) {
      msg += `*Coordenadas Satelitales:* ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}\n`;
      msg += `*🗺️ Ubicación GPS directo:* https://maps.google.com/?q=${location.lat},${location.lng}\n`;
      if (location.accuracy) msg += `_Precisión ±${location.accuracy}m_\n`;
    } else if (location && location.isGuardia) {
      msg += `*Ubicación:* 📍 SERVICIO DE GUARDIA DE LA UNIDAD\n`;
    } else {
      msg += `*Ubicación:* Alerta Rápida (Sin GPS o en proceso)\n`;
    }
    msg += `\n_Enviado automáticamente desde PWA SOSCOOP Táctico_`;

    const encodedMsg = encodeURIComponent(msg);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedMsg}`;
    
    window.open(whatsappUrl, '_blank');
  }

  /**
   * Formatea el primer nombre: primera letra en mayúscula y el resto minúscula.
   * Si se ingresan dos nombres (ej: "juan carlos"), aplica a cada uno o a toda la cadena.
   */
  formatFirstName(str) {
    if (!str) return '';
    return str.split(' ').map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
  }

  checkSession() {
    const saved = localStorage.getItem('soscoop_current_operator');
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
        this.operatorDisplayName.textContent = this.currentUser.fullName;
        this.showView('dashboard');
        return;
      } catch (e) {}
    }
    this.showView('login');
  }

  loginUser(userObj) {
    this.currentUser = userObj;
    localStorage.setItem('soscoop_current_operator', JSON.stringify(userObj));
    this.operatorDisplayName.textContent = userObj.fullName;
    window.audioService.playTacticalClick();
    this.showView('dashboard');
  }

  logoutUser() {
    if (confirm('¿Confirmas que deseas salir del turno operativo en SOSCOOP?')) {
      localStorage.removeItem('soscoop_current_operator');
      this.currentUser = null;
      window.audioService.stopAlarm();
      this.showView('login');
    }
  }

  showView(viewName) {
    [this.loginView, this.dashboardView, this.feedView].forEach(view => {
      if (view) {
        view.classList.remove('active');
        view.classList.add('hidden');
      }
    });

    if (viewName === 'login') {
      this.loginView.classList.remove('hidden');
      setTimeout(() => this.loginView.classList.add('active'), 20);
      document.querySelector('.tactical-nav').classList.add('hidden');
      document.querySelector('.operator-banner').classList.add('hidden');
    } else {
      document.querySelector('.tactical-nav').classList.remove('hidden');
      document.querySelector('.operator-banner').classList.remove('hidden');

      this.navButtons.forEach(btn => {
        if (btn.getAttribute('data-view') === viewName) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      if (viewName === 'dashboard') {
        this.dashboardView.classList.remove('hidden');
        setTimeout(() => this.dashboardView.classList.add('active'), 20);
      } else if (viewName === 'feed') {
        this.feedView.classList.remove('hidden');
        setTimeout(() => this.feedView.classList.add('active'), 20);
        this.renderAlertsFeed();
        if (this.navBadge) {
          this.navBadge.classList.add('hidden');
        }
      }
    }
  }

  async togglePTT() {
    if (!this.isRecordingPTT) {
      const started = await window.audioService.startRecording();
      if (started) {
        this.isRecordingPTT = true;
        this.btnPTT.classList.add('recording');
        this.pttText.textContent = '🔴 Grabando Audio... Toca para detener';
      }
    } else {
      const audioResult = await window.audioService.stopRecording();
      this.isRecordingPTT = false;
      this.btnPTT.classList.remove('recording');
      this.pttText.textContent = '🎙️ Grabar Nota de Voz / Radio PTT';

      if (audioResult) {
        this.currentAudioNote = audioResult;
        this.audioPreviewContainer.classList.remove('hidden');
        this.audioPlayerElem.src = audioResult.base64Url;
      }
    }
  }

  /**
   * Emite una alerta de emergencia desde este celular.
   * @param {'colaboracion'|'cooperacion'|'guardia'} alertType 
   */
  async triggerEmergency(alertType) {
    if (!this.currentUser) {
      alert('Debes ingresar tu nombre y apellidos antes de emitir una alerta.');
      return;
    }

    window.audioService.playTacticalClick();

    // Obtener ubicación según tipo (para guardia será nula/fija sin pedir GPS)
    const geoData = await window.geoService.getLocationForAlert(alertType);

    const alertObj = {
      operatorName: this.currentUser.fullName,
      alertType: alertType,
      location: geoData,
      audioNote: this.currentAudioNote ? this.currentAudioNote.base64Url : null,
      audioDuration: this.currentAudioNote ? this.currentAudioNote.durationSec : null
    };

    // Emitir a la red y guardar en historial
    const broadcasted = window.networkService.broadcastAlert(alertObj);

    // Guardar referencia de última alerta
    this.lastAlertSentOrReceived = broadcasted;

    // Si está activada la preferencia de WhatsApp, enviar automáticamente el mensaje al grupo
    if (this.isWhatsAppEnabled) {
      this.sendToWhatsApp(alertType, geoData, this.currentUser.fullName);
    }

    // Si se adjuntó audio, limpiarlo del área temporal
    if (this.currentAudioNote) {
      this.currentAudioNote = null;
      this.audioPreviewContainer.classList.add('hidden');
      this.audioPlayerElem.src = '';
    }

    // Al activarla yo mismo, abrir también el modal de baliza para confirmación y alarma en sala
    this.openStrobeModal(broadcasted);
    this.renderAlertsFeed();
  }

  setupNetworkListeners() {
    window.networkService.onAlertReceived((alertData, isLocalBroadcast) => {
      // Activar la baliza y sirena siempre (o cuando entra de otra pestaña/celular)
      if (!isLocalBroadcast) {
        this.openStrobeModal(alertData);
      }
      this.renderAlertsFeed();

      // Mostrar badge si no estamos en la pestaña feed
      if (this.feedView.classList.contains('hidden') && this.navBadge) {
        this.navBadge.classList.remove('hidden');
        this.navBadge.textContent = '1';
      }
    });
  }

  /**
   * Muestra la baliza estroboscópica y activa la sirena en el celular
   * @param {Object} alertData 
   */
  openStrobeModal(alertData) {
    this.activeStrobeAlert = alertData;
    const { alertType, operatorName, location, audioNote } = alertData;

    this.strobeModal.className = 'strobe-modal'; // reset de clases

    if (alertType === 'cooperacion') {
      this.strobeModal.classList.add('theme-red');
      this.strobeIconBadge.textContent = '🚨';
      this.strobeTitle.textContent = '¡ COOPERACIÓN URGENTE !';
      window.audioService.playAlarm('cooperacion');
    } else if (alertType === 'colaboracion') {
      this.strobeModal.classList.add('theme-yellow');
      this.strobeIconBadge.textContent = '⚠️';
      this.strobeTitle.textContent = '¡ COLABORACIÓN POLICIAL !';
      window.audioService.playAlarm('colaboracion');
    } else if (alertType === 'guardia') {
      this.strobeModal.classList.add('theme-blue');
      this.strobeIconBadge.textContent = '🛡️';
      this.strobeTitle.textContent = '¡ COOPERACIÓN SERVICIO DE GUARDIA !';
      window.audioService.playAlarm('guardia');
    }

    this.strobeCallerName.textContent = `Operador: ${operatorName}`;
    
    if (location && location.isGuardia) {
      this.strobeLocationText.innerHTML = `<strong>📍 SERVICIO DE GUARDIA DE LA UNIDAD</strong>`;
    } else if (location && location.lat) {
      this.strobeLocationText.innerHTML = `📍 Coordenadas GPS: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)} <br><span style="font-size:11px;opacity:0.8;">Precisión ±${location.accuracy}m</span>`;
    } else {
      this.strobeLocationText.textContent = `📍 Coordenadas en proceso...`;
    }

    this.lastAlertSentOrReceived = alertData;
    if (this.btnWhatsappResend) {
      this.btnWhatsappResend.classList.remove('hidden');
    }

    this.strobeModal.classList.remove('hidden');

    // Reproducir nota de voz automáticamente tras 0.5s si existe
    if (audioNote) {
      setTimeout(() => {
        window.audioService.playAudioNote(audioNote);
      }, 500);
    }
  }

  renderAlertsFeed() {
    if (!this.feedContainer) return;
    const history = window.networkService.getAlertHistory();

    if (history.length === 0) {
      this.feedContainer.innerHTML = `
        <div class="empty-feed">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
          </svg>
          <p style="font-weight:700;">No hay incidentes activos ni historial reciente en la central SOSCOOP.</p>
          <p style="font-size:12px;margin-top:4px;">Las alertas de Colaboración, Cooperación y Guardia aparecerán aquí en tiempo real.</p>
        </div>
      `;
      return;
    }

    this.feedContainer.innerHTML = history.map(item => {
      const isYellow = item.alertType === 'colaboracion';
      const isRed = item.alertType === 'cooperacion';
      const isBlue = item.alertType === 'guardia';

      let cardClass = 'type-colaboracion';
      let badgeClass = 'badge-yellow';
      let badgeText = '🟡 COLABORACIÓN';
      
      if (isRed) {
        cardClass = 'type-cooperacion';
        badgeClass = 'badge-red';
        badgeText = '🔴 COOPERACIÓN URGENTE';
      } else if (isBlue) {
        cardClass = 'type-guardia';
        badgeClass = 'badge-blue';
        badgeText = '🔵 SERVICIO DE GUARDIA';
      }

      let locationHtml = '';
      if (item.location && item.location.isGuardia) {
        // SERVICIO DE GUARDIA (SIN UBICACION GPS)
        locationHtml = `
          <div class="guardia-location-pill">
            <span>🛡️</span>
            <span>SERVICIO DE GUARDIA DE LA UNIDAD</span>
          </div>
        `;
      } else if (item.location && item.location.mapUrl) {
        // EN TERRENO (CON UBICACION GPS)
        locationHtml = `
          <div class="alert-location-box">
            <div class="alert-location-text">
              <span>📍</span>
              <span>${item.location.lat.toFixed(5)}, ${item.location.lng.toFixed(5)}</span>
            </div>
            <a href="${item.location.mapUrl}" target="_blank" class="btn-nav-map">
              <span>🗺️ GPS</span>
            </a>
          </div>
        `;
      }

      let audioHtml = '';
      if (item.audioNote) {
        audioHtml = `
          <div class="alert-audio-player">
            <span style="font-size:14px;">🎙️ Nota de voz PTT</span>
            <audio controls src="${item.audioNote}" style="height:28px; max-width:200px;"></audio>
          </div>
        `;
      }

      return `
        <div class="alert-card ${cardClass}">
          <div class="alert-card-header">
            <span class="alert-badge ${badgeClass}">${badgeText}</span>
            <span class="alert-time">${item.timeFormatted || ''}</span>
          </div>
          <div class="alert-user-info">
            <div class="alert-user-name">${item.operatorName || 'Operador Policial'}</div>
          </div>
          ${locationHtml}
          ${audioHtml}
        </div>
      `;
    }).join('');
  }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.appController = new AppController();
  window.appController.init();
});
