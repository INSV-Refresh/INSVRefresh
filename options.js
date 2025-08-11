function validateAudioFile(input) {
  const file = input.files[0];
  if (!file) {
    document.getElementById('save-audio-btn').disabled = true;
    document.getElementById('audio-preview').innerHTML = '';
    return;
  }

  const validTypes = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/webm"];
  const maxSizeMB = 5;

  if (!validTypes.includes(file.type)) {
    showToast("Formato inválido. Por favor, envie um arquivo MP3, WAV, OGG, MP4 ou WebM.", "error");
    input.value = "";
    document.getElementById('save-audio-btn').disabled = true;
    document.getElementById('audio-preview').innerHTML = '';
    resetDropArea();
    return;
  }

  if (file.size > maxSizeMB * 1024 * 1024) {
    showToast("Arquivo muito grande. O tamanho máximo permitido é 5MB.", "error");
    input.value = "";
    document.getElementById('save-audio-btn').disabled = true;
    document.getElementById('audio-preview').innerHTML = '';
    resetDropArea();
    return;
  }

  showAudioPreview(file);
  
  const nameInput = document.getElementById('custom-audio-name');
  if (!nameInput.value) {
    const fileName = file.name.replace(/\.[^/.]+$/, "");
    nameInput.value = fileName;
  }
  
  document.getElementById('save-audio-btn').disabled = false;
  showDropSuccess();
}

function showAudioPreview(file) {
  const previewContainer = document.getElementById('audio-preview');
  const existingAudio = previewContainer.querySelector('audio');
  
  if (existingAudio) {
    existingAudio.remove();
  }

  const audio = document.createElement('audio');
  audio.controls = true;
  
  const url = URL.createObjectURL(file);
  audio.src = url;
  
  previewContainer.appendChild(audio);
}

function saveCustomAudio() {
  const fileInput = document.getElementById('custom-audio');
  const nameInput = document.getElementById('custom-audio-name');
  const file = fileInput.files[0];
  const customName = nameInput.value.trim();
  
  if (!file) {
    showToast('Por favor, selecione um arquivo de áudio primeiro.', "warning");
    return;
  }
  
  if (!customName) {
    showToast('Por favor, insira um nome para o áudio.', "warning");
    nameInput.focus();
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const audioData = e.target.result;
    const fileName = file.name;
    
    chrome.storage.local.get('audiosPersonalizados', (data) => {
      const customAudios = data.audiosPersonalizados || {};
      const audioKey = 'custom_' + Date.now();
      
      customAudios[audioKey] = {
        data: audioData,
        name: customName,
        originalName: fileName,
        createdAt: new Date().toISOString()
      };
      
      chrome.storage.local.set({ audiosPersonalizados: customAudios }, () => {
        showToast('Áudio personalizado salvo com sucesso!', "success"); 
        loadCustomAudios();
        clearAudioForm();
      });
    });
  };
  
  reader.readAsDataURL(file);
}

function clearAudioForm() {
  const fileInput = document.getElementById('custom-audio');
  const nameInput = document.getElementById('custom-audio-name');
  
  fileInput.value = '';
  nameInput.value = '';
  document.getElementById('save-audio-btn').disabled = true;
  document.getElementById('audio-preview').innerHTML = '';
  resetDropArea();
}

function loadCustomAudios() {
  chrome.storage.local.get('audiosPersonalizados', (data) => {
    const customAudios = data.audiosPersonalizados || {};
    const container = document.getElementById('custom-audios-list');
    
    if (!container) {
      const newContainer = document.createElement('div');
      newContainer.id = 'custom-audios-list';
      document.getElementById('upload-audio').appendChild(newContainer);
      return loadCustomAudios();
    }
    
    container.innerHTML = '';
    
    const audioKeys = Object.keys(customAudios);
    if (audioKeys.length === 0) {
      container.innerHTML = '<p>Nenhum áudio personalizado encontrado.</p>';
      return;
    }
    
    audioKeys.forEach(key => {
      const audioInfo = customAudios[key];
      const audioItem = document.createElement('div');
      
      audioItem.innerHTML = `
        <div>
          <strong>${audioInfo.name}</strong>
          <div class="background-audio-viewer">
            Arquivo: ${audioInfo.originalName}
            ${audioInfo.createdAt ? ' • Adicionado em: ' + new Date(audioInfo.createdAt).toLocaleDateString('pt-BR') : ''}
          </div>
          <audio controls>
            <source src="${audioInfo.data}" type="audio/mpeg">
            Seu navegador não suporta áudio.
          </audio>
        </div>
        <button class="delete-audio-btn" data-audio-key="${key}">
          Excluir
        </button>
      `;
      
      container.appendChild(audioItem);
      
      const deleteBtn = audioItem.querySelector('.delete-audio-btn');
      deleteBtn.addEventListener('click', function() {
        deleteCustomAudio(this.dataset.audioKey);
      });
    });
  });
}

function deleteCustomAudio(audioKey) {
  chrome.storage.local.get('audiosPersonalizados', (data) => {
    const customAudios = data.audiosPersonalizados || {};
    delete customAudios[audioKey];
    
    chrome.storage.local.set({ audiosPersonalizados: customAudios }, () => {
      showToast('Áudio deletado com sucesso!', "success");
      loadCustomAudios();
    });
  });
}

function showToast(message, type = "success", duration = 5000) {
  const container = document.getElementById("toast-container");
  
  if (!container) {
    console.error("Toast container não encontrado");
    return;
  }

  const toast = document.createElement("div");
  toast.classList.add("toast", `toast-${type}`);
  toast.textContent = message;

  container.appendChild(toast);
  
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, duration);
}

function setupDragAndDrop() {
  const dropArea = document.getElementById('drop-area');
  const fileInput = document.getElementById('custom-audio');
  const browseBtn = document.getElementById('browse-btn');

  if (!dropArea || !fileInput || !browseBtn) {
    console.error('Elementos do drag & drop não encontrados');
    return;
  }

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
  });

  dropArea.addEventListener('drop', handleDrop, false);
  
  dropArea.addEventListener('click', (e) => {
    if (e.target !== browseBtn) {
      fileInput.click();
    }
  });
  
  browseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileInput.click();
  });

  fileInput.addEventListener('change', function() {
    validateAudioFile(this);
  });
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function highlight() {
  const dropArea = document.getElementById('drop-area');
  dropArea.classList.add('dragover');
}

function unhighlight() {
  const dropArea = document.getElementById('drop-area');
  dropArea.classList.remove('dragover', 'error');
}

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  
  if (files.length > 1) {
    showDropError('Por favor, selecione apenas um arquivo por vez.');
    return;
  }
  
  if (files.length === 1) {
    handleFiles(files[0]);
  }
}

function handleFiles(file) {
  const validTypes = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/webm"];
  
  if (!validTypes.includes(file.type)) {
    showDropError('Tipo de arquivo não suportado. Use MP3, WAV, OGG, MP4 ou WebM.');
    return;
  }

  const fileInput = document.getElementById('custom-audio');
  const dt = new DataTransfer();
  dt.items.add(file);
  fileInput.files = dt.files;
  
  validateAudioFile(fileInput);
}

function showDropError(message) {
  const dropArea = document.getElementById('drop-area');
  dropArea.classList.add('error');
  showToast(message, 'error');
  
  setTimeout(() => {
    dropArea.classList.remove('error');
  }, 2000);
}

function showDropSuccess() {
  const dropArea = document.getElementById('drop-area');
  const dropContent = dropArea.querySelector('.drop-content');
  
  const originalContent = dropContent.innerHTML;
  dropContent.innerHTML = `
    <div class="drop-icon">✅</div>
    <div class="drop-text">
      <strong>Arquivo carregado com sucesso!</strong>
      <p>Preencha o nome e clique em "Salvar Áudio"</p>
    </div>
  `;
  
  setTimeout(() => {
    dropContent.innerHTML = originalContent;
  }, 3000);
}

function resetDropArea() {
  const dropArea = document.getElementById('drop-area');
  const dropContent = dropArea.querySelector('.drop-content');
  
  dropArea.classList.remove('dragover', 'error');
  dropContent.innerHTML = `
    <div class="drop-icon">🎵</div>
    <div class="drop-text">
      <strong>Arraste um arquivo de áudio aqui</strong>
      <p>ou <button type="button" id="browse-btn" class="browse-btn">clique para procurar</button></p>
    </div>
    <div class="drop-formats">
      Formatos: MP3, WAV, OGG, MP4, WebM (máx. 5MB)
    </div>
  `;
  
  const newBrowseBtn = dropContent.querySelector('#browse-btn');
  if (newBrowseBtn) {
    newBrowseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.getElementById('custom-audio').click();
    });
  }
}

document.addEventListener('DOMContentLoaded', function() {
  setupDragAndDrop();
  
  const saveBtn = document.getElementById('save-audio-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveCustomAudio);
  }
  
  loadCustomAudios();

  const legacyCheckbox = document.getElementById('legacyMode');
  if (legacyCheckbox) {
    chrome.storage.sync.get(['legacyMode'], (result) => {
      legacyCheckbox.checked = result.legacyMode || false;
    });

    legacyCheckbox.addEventListener('change', () => {
      chrome.storage.sync.set({ legacyMode: legacyCheckbox.checked });
      showToast("Modo Legacy " + (legacyCheckbox.checked ? "ativado" : "desativado"), "success");
    });
  }
});


document.querySelectorAll(".menu a").forEach(link => {
    link.addEventListener("click", function (e) {
        e.preventDefault();
        const targetId = this.getAttribute("href").substring(1);
        var section = document.getElementById(targetId);

        document.querySelectorAll(".highlight").forEach(el => {
            el.classList.remove("highlight");
        });

        if (targetId == "top"){
          window.scrollTo({ top: 0, behavior: "smooth" });
          section = document.getElementById('intro');
        }


        if (section) {
            const title = section.querySelector("h1, h2");
            title.classList.add("highlight");

            if (targetId !== "top"){
            section.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }
    });
});
