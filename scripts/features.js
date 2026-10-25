// Recursos do Modo API (leitura das filas pela API do Salesforce e
// atualização em tempo real por Change Data Capture).
//
// Desligados nesta versão de propósito. O modo API e o streaming funcionam,
// mas cada verificação consome cota de API do org, e essa cota é compartilhada
// por toda a empresa: liberar isso para qualquer usuário sem acordo com a
// organização (limites e responsabilidade) derruba a integração de quem não
// pediu nada. A liberação é combinada com cada empresa pelo contato comercial.
//
// Religar é flipar aqui. Junto voltam as permissões opcionais no manifest
// (cookies + host do org) e uma tela de gestão nas opções, removidas
// enquanto o recurso está inalcançável.
//
// Carregado em três escopos isolados que não compartilham global:
// content script (manifest.json), página de opções (options.html) e service
// worker (importScripts em service-worker.js).
const API_FEATURES = { apiMode: false, stream: false };
