window.onload = function () {
  console.log("[Debug] GRID REFRESH ATIVADO");

  chrome.storage.sync.get(["legacyMode", "legacyInterval", "legacyActive"], (result) => {
    if (result.legacyMode) {
      if (result.legacyActive) {
        console.log("[Debug] LEGACY MODE ATIVADO");
        initLegacyMode(result.legacyInterval || 10);
      } else {
        console.log("[Debug] LEGACY MODE CONFIGURADO MAS INATIVO");
        initLegacyModeListener();
      }
      return;
    }

    initNormalMode();
  });
};

function initLegacyModeListener() {
  console.log("[Debug] Aguardando ativação do Legacy Mode");

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync") {
      if (changes.legacyMode && !changes.legacyMode.newValue) {
        console.log("[Debug] Legacy Mode desativado. Recarregando página...");
        window.location.reload();
        return;
      }

      if (changes.legacyActive && changes.legacyActive.newValue) {
        chrome.storage.sync.get(["legacyInterval"], (result) => {
          console.log("[Debug] Legacy Mode foi ativado");
          initLegacyMode(result.legacyInterval || 10);
        });
      }
    }
  });
}

function initLegacyMode(intervalSeconds) {
  console.log(`[Debug] Iniciando Legacy Mode com intervalo de ${intervalSeconds} segundos`);

  let legacyTimer = null;

  function legacyRefresh() {
    console.log("[Debug] Executando refresh legacy");
    const refreshButton = document.querySelector('button[name="refreshButton"]');
    if (refreshButton) {
      refreshButton.click();
      console.log("[Debug] Botão de refresh clicado (Legacy Mode)");
    } else {
      console.log("[Debug] Botão de refresh não encontrado");
    }
  }

  function startLegacyTimer(interval) {
    if (legacyTimer) {
      clearInterval(legacyTimer);
    }
    legacyTimer = setInterval(legacyRefresh, interval * 1000);
    console.log(`[Debug] Timer do Legacy Mode configurado para ${interval} segundos`);
  }

  function stopLegacyTimer() {
    if (legacyTimer) {
      clearInterval(legacyTimer);
      legacyTimer = null;
      console.log("[Debug] Timer do Legacy Mode parado");
    }
  }

  legacyRefresh();

  startLegacyTimer(intervalSeconds);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync") {
      if (changes.legacyMode && !changes.legacyMode.newValue) {
        console.log("[Debug] Legacy Mode desativado. Recarregando página...");
        stopLegacyTimer();
        window.location.reload();
        return;
      }

      chrome.storage.sync.get(["legacyMode", "legacyActive", "legacyInterval"], (result) => {
        if (!result.legacyMode) return;

        if (changes.legacyActive) {
          if (changes.legacyActive.newValue) {
            console.log("[Debug] Legacy Mode ativado");
            startLegacyTimer(result.legacyInterval || 10);
          } else {
            console.log("[Debug] Legacy Mode pausado");
            stopLegacyTimer();
          }
        }

        if (changes.legacyInterval && result.legacyActive) {
          console.log(`[Debug] Intervalo do Legacy Mode alterado para ${changes.legacyInterval.newValue} segundos`);
          startLegacyTimer(changes.legacyInterval.newValue);
        }
      });
    }
  });

  console.log("[Debug] Legacy Mode configurado com sucesso");
}

function initNormalMode() {
  console.log("[Debug] Iniciando modo normal com todas as funcionalidades");

  let audioEnabled = false;

  document.addEventListener(
    "click",
    () => {
      audioEnabled = true;
      console.log("[Debug] Som ativado após clique");
    },
    { once: true }
  );

  function isRightQueue(queueName) {
    const title = document.querySelector(".slds-page-header__title");
    return title && title.innerText.toLowerCase().trim() === queueName.toLowerCase().trim();
  }

  function getNewCaseIds(seenCaseIds) {
    const caseLinks = document.querySelectorAll('.mainContentMark .split-left table[role="grid"] tbody tr th span a');
    const newIds = [];

    caseLinks.forEach((link) => {
      const caseId = link.textContent.trim();
      if (!seenCaseIds.has(caseId)) {
        newIds.push(caseId);
      }
    });

    return newIds;
  }

  function tocarSom(soundName, volume) {
    if (!audioEnabled) {
      console.log("[Debug] Audio desabilitado, clique na tela");
      return;
    }

    if (soundName.startsWith("custom_")) {
      chrome.storage.local.get("audiosPersonalizados", (data) => {
        const customAudios = data.audiosPersonalizados || {};
        const customAudio = customAudios[soundName];

        if (customAudio && customAudio.data) {
          console.log(`[Debug] Tocando áudio personalizado: ${customAudio.name}`);
          try {
            const base64Data = customAudio.data.split(",")[1];
            const mimeType = customAudio.data.split(",")[0].split(":")[1].split(";")[0];
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: mimeType });
            const blobUrl = URL.createObjectURL(blob);
            const audio = new Audio(blobUrl);
            audio.volume = volume;
            audio.addEventListener("ended", () => {
              URL.revokeObjectURL(blobUrl);
            });
            audio.addEventListener("error", (e) => {
              console.error("Erro ao tocar áudio personalizado:", e);
              URL.revokeObjectURL(blobUrl);
              tocarSomPadrao("notification.mp3", volume);
            });
            audio.play().catch((e) => {
              console.error("Erro ao tocar áudio personalizado:", e);
              URL.revokeObjectURL(blobUrl);
              tocarSomPadrao("notification.mp3", volume);
            });
          } catch (error) {
            console.error("Erro ao processar áudio personalizado:", error);
            tocarSomPadrao("notification.mp3", volume);
          }
        } else {
          console.error(`[Debug] Áudio personalizado não encontrado: ${soundName}`);
          tocarSomPadrao("notification.mp3", volume);
        }
      });
    } else {
      tocarSomPadrao(soundName, volume);
    }
  }

  function tocarSomPadrao(soundName, volume) {
    console.log(`[Debug] Tocando áudio padrão: ${soundName}`);
    const audioSrc = chrome.runtime.getURL("assets/sounds/" + soundName);
    const audio = new Audio(audioSrc);
    audio.volume = volume;
    audio.play().catch((e) => console.error("Erro ao tocar o som padrão:", e));
  }

  const filaMonitores = new Map();

  function iniciarMonitoramentoFila(fila, globalSound, globalVolume) {
    let seenCaseIds = new Set();

    const loop = () => {
      if (!isRightQueue(fila.name)) {
        console.log(`[Debug] Retornando, fila incorreta: ${fila.name}`);
        return;
      }

      const userIsEditing = document.querySelector(".mainContentMark .split-left .slds-checkbox [type=checkbox]:checked");

      if (!userIsEditing) {
        console.log(`[Debug] Executando refresh da fila: "${fila.name}"`);
        const el = document.querySelector('button[name="refreshButton"]');
        if (el) el.click();
      } else {
        console.log("[Debug] Ignorou refresh - usuário está com chamado selecionado");
      }

      setTimeout(() => {
        const novos = getNewCaseIds(seenCaseIds);

        if (novos.length > 0 && fila.soundEnabled) {
          console.log(`[Debug] Novos casos na fila "${fila.name}": "${novos}"`);
          const soundToUse = fila.customSound || globalSound;
          console.log(`[Debug] Som para fila "${fila.name}": ${soundToUse}`);
          if (isRightQueue(fila.name)) {
            tocarSom(soundToUse, globalVolume);
          }
        }

        novos.forEach((id) => seenCaseIds.add(id));
      }, 1500);
    };
    const intervalo = setInterval(loop, (fila.interval || 15) * 1000);
    filaMonitores.set(fila.name, intervalo);
  }

  function pararMonitoramentosAtuais() {
    filaMonitores.forEach((intervalId, nomeFila) => {
      clearInterval(intervalId);
      console.log(`[Debug] Parando monitoramento da fila: ${nomeFila}`);
    });
    filaMonitores.clear();
  }

  function carregarEIniciarTodos() {
    chrome.storage.local.get(["queues", "general"], (data) => {
      const filas = (data.queues || []).filter((q) => q.active);
      const defaultSound = "notification.mp3";
      const volume = (data.general && data.general.volume) || 0.5;

      console.log(`[Debug] Som padrão: ${defaultSound}`);
      console.log(`[Debug] Volume: ${volume}`);

      pararMonitoramentosAtuais();

      filas.forEach((fila) => {
        if (fila.name) {
          console.log(`[Debug] Iniciando monitoramento da fila: "${fila.name}"`);
          iniciarMonitoramentoFila(fila, defaultSound, volume);
        }
      });
    });
  }

  carregarEIniciarTodos();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.queues || changes.general || changes.audiosPersonalizados)) {
      console.log("[Debug] Alterações detectadas no storage. Reiniciando monitoramento...");
      carregarEIniciarTodos();
    }

    if (area === "sync" && changes.legacyMode && changes.legacyMode.newValue && !changes.legacyMode.oldValue) {
      console.log("[Debug] Legacy Mode foi ativado pela primeira vez. Recarregando página...");
      window.location.reload();
    }
  });
}
