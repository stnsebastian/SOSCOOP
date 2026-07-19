/**
 * NetworkService - SOSCOOP
 * Canal de comunicación táctica en tiempo real utilizando BroadcastChannel
 * para sincronizar alertas instantáneamente entre celulares/pestañas abiertas,
 * además de persistir el historial en localStorage.
 */

class NetworkService {
  constructor() {
    this.channelName = 'soscoop_emergency_channel_v1';
    this.channel = null;
    this.listeners = [];
    this.initChannel();
  }

  initChannel() {
    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(this.channelName);
      this.channel.onmessage = (event) => {
        const alertData = event.data;
        if (alertData && alertData.id) {
          console.log('[NetworkService] Alerta recibida vía BroadcastChannel:', alertData);
          this.saveToLocalHistory(alertData);
          this.notifyListeners(alertData, false); // false = no fui yo quien la emitió
        }
      };
    }
  }

  onAlertReceived(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }

  notifyListeners(alertData, isLocalBroadcast) {
    this.listeners.forEach(cb => {
      try {
        cb(alertData, isLocalBroadcast);
      } catch (e) {
        console.error('Error en listener de alerta:', e);
      }
    });
  }

  /**
   * Emite una nueva alerta táctica a toda la red SOSCOOP
   * @param {Object} alertObj 
   */
  broadcastAlert(alertObj) {
    const alertData = {
      ...alertObj,
      id: alertObj.id || `SOS_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: alertObj.timestamp || new Date().toISOString(),
      timeFormatted: alertObj.timeFormatted || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    // Guardar en historial local
    this.saveToLocalHistory(alertData);

    // Enviar a otros dispositivos / pestañas vía BroadcastChannel
    if (this.channel) {
      try {
        this.channel.postMessage(alertData);
      } catch (e) {
        console.warn('No se pudo postMessage al canal:', e);
      }
    }

    // Notificar localmente que se emitió con éxito
    this.notifyListeners(alertData, true);
    return alertData;
  }

  saveToLocalHistory(alertData) {
    try {
      const history = this.getAlertHistory();
      // Evitar duplicados por ID
      if (!history.some(item => item.id === alertData.id)) {
        history.unshift(alertData);
        // Limitar a los últimos 50 reportes
        const trimmed = history.slice(0, 50);
        localStorage.setItem('soscoop_alerts_history', JSON.stringify(trimmed));
      }
    } catch (e) {
      console.warn('Error al guardar en localStorage:', e);
    }
  }

  getAlertHistory() {
    try {
      const raw = localStorage.getItem('soscoop_alerts_history');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  clearHistory() {
    localStorage.removeItem('soscoop_alerts_history');
  }

  /**
   * Simula una alerta entrante de prueba desde unidades operativas en terreno o central
   */
  simulateIncomingAlert(forcedType) {
    const types = ['colaboracion', 'cooperacion', 'guardia'];
    const selectedType = forcedType || types[Math.floor(Math.random() * types.length)];
    
    const simulatedOperators = [
      'Sargento 1ro M. TORRES VALDES',
      'Cabo 2do P. SALAS MUÑOZ',
      'Suboficial R. BRAVO CASTRO',
      'Teniente A. FUENTES TAPIA',
      'Cabo 1ro C. SEPULVEDA VERA'
    ];
    
    const operator = simulatedOperators[Math.floor(Math.random() * simulatedOperators.length)];
    
    let locationData;
    if (selectedType === 'guardia') {
      locationData = {
        lat: null,
        lng: null,
        accuracy: null,
        label: '📍 SERVICIO DE GUARDIA DE LA UNIDAD',
        isGuardia: true,
        mapUrl: null
      };
    } else {
      const lat = -33.4489 + (Math.random() - 0.5) * 0.02;
      const lng = -70.6693 + (Math.random() - 0.5) * 0.02;
      locationData = {
        lat: lat,
        lng: lng,
        accuracy: 12,
        label: `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)} (±12m)`,
        isGuardia: false,
        mapUrl: `https://www.google.com/maps?q=${lat},${lng}`
      };
    }

    const alertData = {
      id: `SIM_${Date.now()}`,
      operatorName: operator,
      alertType: selectedType,
      location: locationData,
      audioNote: null, // o se puede adjuntar un audio corto si se requiere
      timestamp: new Date().toISOString(),
      timeFormatted: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    console.log('[NetworkService] Simulating incoming tactical alert:', alertData);
    this.saveToLocalHistory(alertData);
    this.notifyListeners(alertData, false); // false = es entrante
    return alertData;
  }
}

window.networkService = new NetworkService();
