// ── i18n — pt_BR / en / es ───────────────────────────────────
// Helper próprio (em vez de chrome.i18n) para permitir troca de
// idioma em runtime pelo seletor no options. Idioma persistido em
// chrome.storage.local.lang; default = idioma do navegador; fallback
// pt-BR. Uso: t("chave"), t("chave", {n: 3}); no HTML, data-i18n,
// data-i18n-placeholder, data-i18n-tooltip, data-i18n-title,
// data-i18n-aria. Nomes de filas e dados do usuário nunca são
// traduzidos.

const I18N_MESSAGES = {
  pt_BR: {
    // Comum
    active: "Ativo",
    inactive: "Inativo",
    sound_default: "Padrão",
    queue_name_ph: "Nome da fila",
    remove_queue: "Remover fila",
    see_plans: "Ver planos →",
    locked_paid: "🔒 Disponível no plano pago.",

    // Popup
    saving: "Salvando configurações...",
    tt_settings: "Conheça mais sobre a extensão",
    tt_add_queue: "Adicionar fila",
    volume_title: "Volume da notificação",
    legacy_mode: "Modo Legacy",
    tt_legacy: "Desative o modo legacy para mais funcionalidades!",
    feedback: "Enviar feedback",
    paused_banner: "⏸️ Atualização pausada",
    resume: "Retomar",
    drag_reorder: "Arrastar para reordenar",
    copy_queue_name: "Copiar nome da fila",
    tt_notify_new: "Notificar novos chamados",
    open_sf: "Abra uma página do Salesforce",
    reload_sf: "Recarregue a página do Salesforce",
    detect_fail: "Não foi possível detectar a fila",
    copied: "\"{name}\" copiado!",
    copy_fail: "Não foi possível copiar",
    multi_queue_paid: "Múltiplas filas disponível no plano pago",
    tt_premium: "⭐ Premium — ver planos",
    subscribe_multi: "⭐ Assine para múltiplas filas",
    hidden_one: "🔒 1 fila adicional disponível no plano pago",
    hidden_many: "🔒 {n} filas adicionais disponíveis no plano pago",

    // Options — sidebar
    menu_intro: "🏠 Introdução",
    menu_features: "✨ Funcionalidades",
    menu_upload: "🎵 Upload de Áudio",
    menu_saved: "🎧 Áudios salvos",
    menu_status: "🔔 Notificar status",
    menu_advanced: "🛠️ Avançado",
    menu_backup: "💾 Backup",
    menu_legacy: "⚙️ Modo Legacy",
    menu_plans: "⭐ Planos",
    review_us: 'Avalie nossa extensão! <span class="glowPulse">✨</span>',

    // Options — intro/funcionalidades
    intro_title: "Bem-vindo!",
    intro_p: "Aqui você encontra as configurações e recursos disponíveis na extensão INSV Refresh.",
    coming_soon: "EM BREVE",
    video_unsupported: "Seu navegador não suporta a visualização de vídeos.",
    video_caption: "Exemplo visual do funcionamento da extensão.",
    features_title: "Funcionalidades",
    feat1_t: "Monitoramento Inteligente",
    feat1_p: "Atualiza filas automaticamente sem interromper pesquisas ou seleções.",
    feat2_t: "Notificações Sonoras",
    feat2_p: "Emite som ao detectar novos chamados ou mudanças de status.",
    feat3_t: "Anti-Interrupção",
    feat3_p: "Pausa o refresh quando há chamados selecionados.",
    feat4_t: "Áudios Personalizados",
    feat4_p: "Faça upload dos seus próprios sons de notificação.",
    feat5_t: "Múltiplas Filas",
    feat5_p: "Intervalos e sons diferentes para cada fila monitorada.",
    feat6_t: "Atalho de Teclado",
    feat6_p: "Aceite chamados instantaneamente com um atalho configurável.",

    // Options — upload de áudio
    upload_title: "Upload de Som Personalizado",
    upload_p: "Adicione seus próprios arquivos de áudio para usar como notificações.",
    drop_strong: "Arraste um arquivo de áudio aqui",
    drop_or: "ou",
    drop_browse: "clique para procurar",
    drop_formats: "Formatos: MP3, WAV, OGG, MP4, WebM (máx. 5MB)",
    audio_name_label: "Nome para exibir:",
    audio_name_ph: "Ex: Meu Som Favorito",
    save_audio: "💾 Salvar Áudio",
    saved_audios_title: "Áudios Personalizados Salvos",
    loading_audios: "Carregando áudios personalizados...",
    no_custom_audio: "Nenhum áudio personalizado encontrado.",
    audio_file: "Arquivo:",
    audio_added_on: "Adicionado em:",
    audio_no_support: "Seu navegador não suporta áudio.",
    delete: "Excluir",
    howto_title: "ℹ️ Como usar áudios personalizados",
    howto_1: "Após salvar, o áudio ficará disponível no popup da extensão",
    howto_2: "Formatos suportados: MP3, WAV, OGG, MP4, WebM",
    howto_3: "Tamanho máximo: 5MB por arquivo",
    howto_4: "Os áudios são salvos localmente no seu navegador",

    // Options — gerenciador de filas / status
    status_title: "Filas e notificação de status",
    status_p: "Gerencie aqui as mesmas filas exibidas no popup. Ative o sino 🔔 para ser notificado com um som quando um chamado da fila for atualizado para um dos status configurados (separe vários status com <strong>;</strong>).",
    add_queue: "+ Adicionar fila",
    qm_bell_title: "Notificar mudança de status desta fila",
    qm_statuses_ph: "Status (ex: Em andamento;Resolvido)",
    qm_statuses_title: "Separe vários status com ;",
    qm_sound_title: "Som da notificação de status",
    queues_saved: "Filas salvas.",

    // Options — avançado
    advanced_title: "Avançado",
    accept_shortcut_label: "Atalho para aceitar chamado",
    accept_shortcut_desc: "Pressione a combinação configurada enquanto estiver na página da fila (fora de campos de texto) para aceitar automaticamente. Mínimo de 2 teclas (ex: Ctrl+Shift+A).",
    pause_shortcut_label: "Atalho para pausar todas as filas",
    pause_shortcut_desc: "Pausa/retoma a atualização de todas as filas de uma vez, sem alterar a configuração individual de cada fila. Mínimo de 2 teclas.",
    shortcut_click: "Clique e pressione o atalho",
    shortcut_press: "Pressione a combinação… (Esc cancela)",
    shortcut_min2: "Mínimo 2 teclas (use um modificador)",
    shortcut_aria_accept: "Capturar atalho para aceitar chamado. Clique e pressione a combinação de teclas. Esc cancela.",
    shortcut_aria_pause: "Capturar atalho para pausar todas as filas. Clique e pressione a combinação de teclas. Esc cancela.",
    clear: "Limpar",
    shortcut_saved: "Atalho salvo.",
    shortcut_removed: "Atalho removido.",

    // Options — backup
    backup_title: "Exportar / Importar Configurações",
    backup_p: "Faça backup das suas configurações ou restaure de um backup anterior. Útil ao trocar de computador ou reinstalar o navegador.",
    export: "📥 Exportar",
    import: "📤 Importar",
    exported: "Configurações exportadas!",
    export_error: "Erro ao exportar: ",
    imported: "Configurações importadas! Recarregue a página.",
    import_error: "Erro ao importar: ",
    invalid_file: "Arquivo inválido",

    // Options — legacy / aparência / idioma
    legacy_title: "Modo Legacy",
    legacy_p: "Versão simplificada que apenas atualiza a página em intervalos regulares, sem notificações ou validações avançadas.",
    legacy_enable: "Ativar Modo Legacy",
    legacy_on: "Modo Legacy ativado",
    legacy_off: "Modo Legacy desativado",
    appearance_title: "Aparência",
    dark_mode: "Modo escuro",
    language_label: "Idioma",

    // Options — banners
    trial_active: "Teste grátis ativo",
    trial_days_left_one: "resta 1 dia",
    trial_days_left: "restam {n} dias",
    subscribe_now: "Assinar agora →",
    changelog_title: "Novidades da versão {v}",
    changelog_dismiss: "Entendi",
    premium_badge: "⭐ Premium",

    // Options — áudio (validações/toasts)
    invalid_format: "Formato inválido. Por favor, envie um arquivo MP3, WAV, OGG, MP4 ou WebM.",
    file_too_big: "Arquivo muito grande. O tamanho máximo permitido é 5MB.",
    select_audio_first: "Por favor, selecione um arquivo de áudio primeiro.",
    enter_audio_name: "Por favor, insira um nome para o áudio.",
    audio_saved: "Áudio personalizado salvo com sucesso!",
    audio_deleted: "Áudio deletado com sucesso!",
    one_file_only: "Por favor, selecione apenas um arquivo por vez.",
    unsupported_type: "Tipo de arquivo não suportado. Use MP3, WAV, OGG, MP4 ou WebM.",
    file_loaded: "Arquivo carregado com sucesso!",
    fill_and_save: 'Preencha o nome e clique em "Salvar Áudio"',

    // Pricing
    pricing_title: "Planos INSV Refresh",
    pricing_sub: "Escolha o plano ideal para você. Recursos essenciais continuam gratuitos.",
    back_to_settings: "← Voltar às configurações",
    plan_free: "Grátis",
    plan_normal: "Normal",
    plan_enterprise: "Empresa",
    price_paid: "Pago",
    price_quote: "Sob consulta",
    free_f1: "1 fila de monitoramento",
    free_f2: "Sons padrão da extensão",
    free_f3: "Notificação de novos chamados",
    free_f4: "Modo Legacy",
    normal_f1: "Tudo do plano Grátis",
    normal_f2: "Múltiplas filas",
    normal_f3: "Áudios personalizados (upload)",
    normal_f4: "Notificação por mudança de status",
    ent_f1: "Para times/empresas inteiros",
    ent_f2: "Preço negociado",
    ent_f3: "Suporte dedicado",
    included: "Já incluso",
    subscribe: "Assinar",
    start_trial: "Iniciar teste grátis de 1 mês",
    contact_email: "Contatar por e-mail",
    login_cta: "Já tem conta? Entrar",
    already_subscribed: "Você já é assinante. Aproveite todos os recursos!",
    trial_already: "Seu teste grátis já está ativo. Restam {n} dia(s).",
    most_popular: "MAIS POPULAR",
  },

  en: {
    active: "Active",
    inactive: "Inactive",
    sound_default: "Default",
    queue_name_ph: "Queue name",
    remove_queue: "Remove queue",
    see_plans: "See plans →",
    locked_paid: "🔒 Available on the paid plan.",

    saving: "Saving settings...",
    tt_settings: "Learn more about the extension",
    tt_add_queue: "Add queue",
    volume_title: "Notification volume",
    legacy_mode: "Legacy Mode",
    tt_legacy: "Disable legacy mode for more features!",
    feedback: "Send feedback",
    paused_banner: "⏸️ Refreshing paused",
    resume: "Resume",
    drag_reorder: "Drag to reorder",
    copy_queue_name: "Copy queue name",
    tt_notify_new: "Notify new cases",
    open_sf: "Open a Salesforce page",
    reload_sf: "Reload the Salesforce page",
    detect_fail: "Could not detect the queue",
    copied: "\"{name}\" copied!",
    copy_fail: "Could not copy",
    multi_queue_paid: "Multiple queues available on the paid plan",
    tt_premium: "⭐ Premium — see plans",
    subscribe_multi: "⭐ Subscribe for multiple queues",
    hidden_one: "🔒 1 additional queue available on the paid plan",
    hidden_many: "🔒 {n} additional queues available on the paid plan",

    menu_intro: "🏠 Introduction",
    menu_features: "✨ Features",
    menu_upload: "🎵 Audio Upload",
    menu_saved: "🎧 Saved audios",
    menu_status: "🔔 Status notifications",
    menu_advanced: "🛠️ Advanced",
    menu_backup: "💾 Backup",
    menu_legacy: "⚙️ Legacy Mode",
    menu_plans: "⭐ Plans",
    review_us: 'Rate our extension! <span class="glowPulse">✨</span>',

    intro_title: "Welcome!",
    intro_p: "Here you can find the settings and features available in the INSV Refresh extension.",
    coming_soon: "COMING SOON",
    video_unsupported: "Your browser does not support video playback.",
    video_caption: "Visual example of how the extension works.",
    features_title: "Features",
    feat1_t: "Smart Monitoring",
    feat1_p: "Refreshes queues automatically without interrupting searches or selections.",
    feat2_t: "Sound Notifications",
    feat2_p: "Plays a sound when new cases or status changes are detected.",
    feat3_t: "Anti-Interruption",
    feat3_p: "Pauses the refresh while cases are selected.",
    feat4_t: "Custom Audios",
    feat4_p: "Upload your own notification sounds.",
    feat5_t: "Multiple Queues",
    feat5_p: "Different intervals and sounds for each monitored queue.",
    feat6_t: "Keyboard Shortcut",
    feat6_p: "Accept cases instantly with a configurable shortcut.",

    upload_title: "Custom Sound Upload",
    upload_p: "Add your own audio files to use as notifications.",
    drop_strong: "Drag an audio file here",
    drop_or: "or",
    drop_browse: "click to browse",
    drop_formats: "Formats: MP3, WAV, OGG, MP4, WebM (max. 5MB)",
    audio_name_label: "Display name:",
    audio_name_ph: "E.g.: My Favorite Sound",
    save_audio: "💾 Save Audio",
    saved_audios_title: "Saved Custom Audios",
    loading_audios: "Loading custom audios...",
    no_custom_audio: "No custom audio found.",
    audio_file: "File:",
    audio_added_on: "Added on:",
    audio_no_support: "Your browser does not support audio.",
    delete: "Delete",
    howto_title: "ℹ️ How to use custom audios",
    howto_1: "After saving, the audio becomes available in the extension popup",
    howto_2: "Supported formats: MP3, WAV, OGG, MP4, WebM",
    howto_3: "Maximum size: 5MB per file",
    howto_4: "Audios are stored locally in your browser",

    status_title: "Queues and status notifications",
    status_p: "Manage here the same queues shown in the popup. Enable the bell 🔔 to get a sound notification when a case in the queue is updated to one of the configured statuses (separate multiple statuses with <strong>;</strong>).",
    add_queue: "+ Add queue",
    qm_bell_title: "Notify status changes for this queue",
    qm_statuses_ph: "Statuses (e.g.: In progress;Resolved)",
    qm_statuses_title: "Separate multiple statuses with ;",
    qm_sound_title: "Status notification sound",
    queues_saved: "Queues saved.",

    advanced_title: "Advanced",
    accept_shortcut_label: "Shortcut to accept a case",
    accept_shortcut_desc: "Press the configured combination while on the queue page (outside text fields) to accept automatically. Minimum of 2 keys (e.g.: Ctrl+Shift+A).",
    pause_shortcut_label: "Shortcut to pause all queues",
    pause_shortcut_desc: "Pauses/resumes refreshing for all queues at once, without changing each queue's individual setting. Minimum of 2 keys.",
    shortcut_click: "Click and press the shortcut",
    shortcut_press: "Press the combination… (Esc cancels)",
    shortcut_min2: "Minimum 2 keys (use a modifier)",
    shortcut_aria_accept: "Capture shortcut to accept a case. Click and press the key combination. Esc cancels.",
    shortcut_aria_pause: "Capture shortcut to pause all queues. Click and press the key combination. Esc cancels.",
    clear: "Clear",
    shortcut_saved: "Shortcut saved.",
    shortcut_removed: "Shortcut removed.",

    backup_title: "Export / Import Settings",
    backup_p: "Back up your settings or restore from a previous backup. Useful when switching computers or reinstalling the browser.",
    export: "📥 Export",
    import: "📤 Import",
    exported: "Settings exported!",
    export_error: "Export error: ",
    imported: "Settings imported! Reload the page.",
    import_error: "Import error: ",
    invalid_file: "Invalid file",

    legacy_title: "Legacy Mode",
    legacy_p: "Simplified version that just refreshes the page at regular intervals, without notifications or advanced validations.",
    legacy_enable: "Enable Legacy Mode",
    legacy_on: "Legacy Mode enabled",
    legacy_off: "Legacy Mode disabled",
    appearance_title: "Appearance",
    dark_mode: "Dark mode",
    language_label: "Language",

    trial_active: "Free trial active",
    trial_days_left_one: "1 day left",
    trial_days_left: "{n} days left",
    subscribe_now: "Subscribe now →",
    changelog_title: "What's new in version {v}",
    changelog_dismiss: "Got it",
    premium_badge: "⭐ Premium",

    invalid_format: "Invalid format. Please upload an MP3, WAV, OGG, MP4 or WebM file.",
    file_too_big: "File too large. The maximum allowed size is 5MB.",
    select_audio_first: "Please select an audio file first.",
    enter_audio_name: "Please enter a name for the audio.",
    audio_saved: "Custom audio saved successfully!",
    audio_deleted: "Audio deleted successfully!",
    one_file_only: "Please select only one file at a time.",
    unsupported_type: "Unsupported file type. Use MP3, WAV, OGG, MP4 or WebM.",
    file_loaded: "File loaded successfully!",
    fill_and_save: 'Fill in the name and click "Save Audio"',

    pricing_title: "INSV Refresh Plans",
    pricing_sub: "Choose the right plan for you. Essential features remain free.",
    back_to_settings: "← Back to settings",
    plan_free: "Free",
    plan_normal: "Normal",
    plan_enterprise: "Enterprise",
    price_paid: "Paid",
    price_quote: "On request",
    free_f1: "1 monitoring queue",
    free_f2: "Built-in extension sounds",
    free_f3: "New case notifications",
    free_f4: "Legacy Mode",
    normal_f1: "Everything in the Free plan",
    normal_f2: "Multiple queues",
    normal_f3: "Custom audios (upload)",
    normal_f4: "Status change notifications",
    ent_f1: "For whole teams/companies",
    ent_f2: "Negotiated price",
    ent_f3: "Dedicated support",
    included: "Included",
    subscribe: "Subscribe",
    start_trial: "Start 1-month free trial",
    contact_email: "Contact by e-mail",
    login_cta: "Already have an account? Sign in",
    already_subscribed: "You are already a subscriber. Enjoy all features!",
    trial_already: "Your free trial is already active. {n} day(s) left.",
    most_popular: "MOST POPULAR",
  },

  es: {
    active: "Activo",
    inactive: "Inactivo",
    sound_default: "Predeterminado",
    queue_name_ph: "Nombre de la cola",
    remove_queue: "Eliminar cola",
    see_plans: "Ver planes →",
    locked_paid: "🔒 Disponible en el plan de pago.",

    saving: "Guardando configuración...",
    tt_settings: "Conoce más sobre la extensión",
    tt_add_queue: "Agregar cola",
    volume_title: "Volumen de la notificación",
    legacy_mode: "Modo Legacy",
    tt_legacy: "¡Desactiva el modo legacy para más funcionalidades!",
    feedback: "Enviar comentarios",
    paused_banner: "⏸️ Actualización pausada",
    resume: "Reanudar",
    drag_reorder: "Arrastrar para reordenar",
    copy_queue_name: "Copiar nombre de la cola",
    tt_notify_new: "Notificar nuevos casos",
    open_sf: "Abre una página de Salesforce",
    reload_sf: "Recarga la página de Salesforce",
    detect_fail: "No se pudo detectar la cola",
    copied: "¡\"{name}\" copiado!",
    copy_fail: "No se pudo copiar",
    multi_queue_paid: "Múltiples colas disponibles en el plan de pago",
    tt_premium: "⭐ Premium — ver planes",
    subscribe_multi: "⭐ Suscríbete para múltiples colas",
    hidden_one: "🔒 1 cola adicional disponible en el plan de pago",
    hidden_many: "🔒 {n} colas adicionales disponibles en el plan de pago",

    menu_intro: "🏠 Introducción",
    menu_features: "✨ Funcionalidades",
    menu_upload: "🎵 Subir Audio",
    menu_saved: "🎧 Audios guardados",
    menu_status: "🔔 Notificar estado",
    menu_advanced: "🛠️ Avanzado",
    menu_backup: "💾 Copia de seguridad",
    menu_legacy: "⚙️ Modo Legacy",
    menu_plans: "⭐ Planes",
    review_us: '¡Califica nuestra extensión! <span class="glowPulse">✨</span>',

    intro_title: "¡Bienvenido!",
    intro_p: "Aquí encontrarás las configuraciones y recursos disponibles en la extensión INSV Refresh.",
    coming_soon: "PRÓXIMAMENTE",
    video_unsupported: "Tu navegador no soporta la reproducción de videos.",
    video_caption: "Ejemplo visual del funcionamiento de la extensión.",
    features_title: "Funcionalidades",
    feat1_t: "Monitoreo Inteligente",
    feat1_p: "Actualiza colas automáticamente sin interrumpir búsquedas o selecciones.",
    feat2_t: "Notificaciones Sonoras",
    feat2_p: "Emite un sonido al detectar nuevos casos o cambios de estado.",
    feat3_t: "Anti-Interrupción",
    feat3_p: "Pausa la actualización cuando hay casos seleccionados.",
    feat4_t: "Audios Personalizados",
    feat4_p: "Sube tus propios sonidos de notificación.",
    feat5_t: "Múltiples Colas",
    feat5_p: "Intervalos y sonidos diferentes para cada cola monitoreada.",
    feat6_t: "Atajo de Teclado",
    feat6_p: "Acepta casos al instante con un atajo configurable.",

    upload_title: "Subir Sonido Personalizado",
    upload_p: "Agrega tus propios archivos de audio para usar como notificaciones.",
    drop_strong: "Arrastra un archivo de audio aquí",
    drop_or: "o",
    drop_browse: "haz clic para buscar",
    drop_formats: "Formatos: MP3, WAV, OGG, MP4, WebM (máx. 5MB)",
    audio_name_label: "Nombre para mostrar:",
    audio_name_ph: "Ej: Mi Sonido Favorito",
    save_audio: "💾 Guardar Audio",
    saved_audios_title: "Audios Personalizados Guardados",
    loading_audios: "Cargando audios personalizados...",
    no_custom_audio: "No se encontró ningún audio personalizado.",
    audio_file: "Archivo:",
    audio_added_on: "Agregado el:",
    audio_no_support: "Tu navegador no soporta audio.",
    delete: "Eliminar",
    howto_title: "ℹ️ Cómo usar audios personalizados",
    howto_1: "Después de guardar, el audio estará disponible en el popup de la extensión",
    howto_2: "Formatos soportados: MP3, WAV, OGG, MP4, WebM",
    howto_3: "Tamaño máximo: 5MB por archivo",
    howto_4: "Los audios se guardan localmente en tu navegador",

    status_title: "Colas y notificación de estado",
    status_p: "Gestiona aquí las mismas colas que se muestran en el popup. Activa la campana 🔔 para recibir una notificación sonora cuando un caso de la cola se actualice a uno de los estados configurados (separa varios estados con <strong>;</strong>).",
    add_queue: "+ Agregar cola",
    qm_bell_title: "Notificar cambios de estado de esta cola",
    qm_statuses_ph: "Estados (ej: En progreso;Resuelto)",
    qm_statuses_title: "Separa varios estados con ;",
    qm_sound_title: "Sonido de la notificación de estado",
    queues_saved: "Colas guardadas.",

    advanced_title: "Avanzado",
    accept_shortcut_label: "Atajo para aceptar un caso",
    accept_shortcut_desc: "Presiona la combinación configurada mientras estés en la página de la cola (fuera de campos de texto) para aceptar automáticamente. Mínimo 2 teclas (ej: Ctrl+Shift+A).",
    pause_shortcut_label: "Atajo para pausar todas las colas",
    pause_shortcut_desc: "Pausa/reanuda la actualización de todas las colas a la vez, sin cambiar la configuración individual de cada cola. Mínimo 2 teclas.",
    shortcut_click: "Haz clic y presiona el atajo",
    shortcut_press: "Presiona la combinación… (Esc cancela)",
    shortcut_min2: "Mínimo 2 teclas (usa un modificador)",
    shortcut_aria_accept: "Capturar atajo para aceptar un caso. Haz clic y presiona la combinación de teclas. Esc cancela.",
    shortcut_aria_pause: "Capturar atajo para pausar todas las colas. Haz clic y presiona la combinación de teclas. Esc cancela.",
    clear: "Borrar",
    shortcut_saved: "Atajo guardado.",
    shortcut_removed: "Atajo eliminado.",

    backup_title: "Exportar / Importar Configuración",
    backup_p: "Haz una copia de seguridad de tu configuración o restáurala desde una copia anterior. Útil al cambiar de computadora o reinstalar el navegador.",
    export: "📥 Exportar",
    import: "📤 Importar",
    exported: "¡Configuración exportada!",
    export_error: "Error al exportar: ",
    imported: "¡Configuración importada! Recarga la página.",
    import_error: "Error al importar: ",
    invalid_file: "Archivo inválido",

    legacy_title: "Modo Legacy",
    legacy_p: "Versión simplificada que solo actualiza la página en intervalos regulares, sin notificaciones ni validaciones avanzadas.",
    legacy_enable: "Activar Modo Legacy",
    legacy_on: "Modo Legacy activado",
    legacy_off: "Modo Legacy desactivado",
    appearance_title: "Apariencia",
    dark_mode: "Modo oscuro",
    language_label: "Idioma",

    trial_active: "Prueba gratis activa",
    trial_days_left_one: "queda 1 día",
    trial_days_left: "quedan {n} días",
    subscribe_now: "Suscribirse ahora →",
    changelog_title: "Novedades de la versión {v}",
    changelog_dismiss: "Entendido",
    premium_badge: "⭐ Premium",

    invalid_format: "Formato inválido. Por favor, sube un archivo MP3, WAV, OGG, MP4 o WebM.",
    file_too_big: "Archivo demasiado grande. El tamaño máximo permitido es 5MB.",
    select_audio_first: "Por favor, selecciona primero un archivo de audio.",
    enter_audio_name: "Por favor, ingresa un nombre para el audio.",
    audio_saved: "¡Audio personalizado guardado con éxito!",
    audio_deleted: "¡Audio eliminado con éxito!",
    one_file_only: "Por favor, selecciona solo un archivo a la vez.",
    unsupported_type: "Tipo de archivo no soportado. Usa MP3, WAV, OGG, MP4 o WebM.",
    file_loaded: "¡Archivo cargado con éxito!",
    fill_and_save: 'Completa el nombre y haz clic en "Guardar Audio"',

    pricing_title: "Planes INSV Refresh",
    pricing_sub: "Elige el plan ideal para ti. Los recursos esenciales siguen siendo gratuitos.",
    back_to_settings: "← Volver a la configuración",
    plan_free: "Gratis",
    plan_normal: "Normal",
    plan_enterprise: "Empresa",
    price_paid: "De pago",
    price_quote: "A consultar",
    free_f1: "1 cola de monitoreo",
    free_f2: "Sonidos integrados de la extensión",
    free_f3: "Notificación de nuevos casos",
    free_f4: "Modo Legacy",
    normal_f1: "Todo lo del plan Gratis",
    normal_f2: "Múltiples colas",
    normal_f3: "Audios personalizados (subida)",
    normal_f4: "Notificación por cambio de estado",
    ent_f1: "Para equipos/empresas enteras",
    ent_f2: "Precio negociado",
    ent_f3: "Soporte dedicado",
    included: "Ya incluido",
    subscribe: "Suscribirse",
    start_trial: "Iniciar prueba gratis de 1 mes",
    contact_email: "Contactar por correo",
    login_cta: "¿Ya tienes cuenta? Entrar",
    already_subscribed: "Ya eres suscriptor. ¡Disfruta de todos los recursos!",
    trial_already: "Tu prueba gratis ya está activa. Queda(n) {n} día(s).",
    most_popular: "MÁS POPULAR",
  },
};

const I18N = {
  lang: "pt_BR",
  dict: I18N_MESSAGES.pt_BR,
};

function i18nDetectLang(stored) {
  if (stored && I18N_MESSAGES[stored]) return stored;
  const nav = (navigator.language || "pt-BR").toLowerCase();
  if (nav.startsWith("en")) return "en";
  if (nav.startsWith("es")) return "es";
  return "pt_BR";
}

function t(key, subs) {
  let str = I18N.dict[key] !== undefined ? I18N.dict[key] : I18N_MESSAGES.pt_BR[key];
  if (str === undefined) return key;
  if (subs) {
    Object.keys(subs).forEach((k) => {
      str = str.split(`{${k}}`).join(subs[k]);
    });
  }
  return str;
}

function applyI18nDom(root) {
  const scope = root || document;
  scope.querySelectorAll("[data-i18n]").forEach((el) => {
    el.innerHTML = t(el.getAttribute("data-i18n"));
  });
  scope.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
  });
  scope.querySelectorAll("[data-i18n-tooltip]").forEach((el) => {
    el.setAttribute("data-tooltip", t(el.getAttribute("data-i18n-tooltip")));
  });
  scope.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.getAttribute("data-i18n-title"));
  });
  scope.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
  });
}

// Promise resolvida quando o idioma persistido foi carregado e o DOM
// estático traduzido. Scripts de página devem aguardar i18nReady
// antes de renderizar conteúdo dinâmico.
const i18nReady = new Promise((resolve) => {
  function init() {
    chrome.storage.local.get("lang", (data) => {
      I18N.lang = i18nDetectLang(data.lang);
      I18N.dict = I18N_MESSAGES[I18N.lang];
      applyI18nDom();
      resolve(I18N.lang);
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
});

// Troca de idioma em runtime (seletor no options)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.lang) {
    I18N.lang = i18nDetectLang(changes.lang.newValue);
    I18N.dict = I18N_MESSAGES[I18N.lang];
    applyI18nDom();
    document.dispatchEvent(new CustomEvent("insv-lang-changed", { detail: { lang: I18N.lang } }));
  }
});
