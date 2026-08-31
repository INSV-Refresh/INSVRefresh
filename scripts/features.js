// Recursos do plano Empresa.
//
// Desligados nesta versão de propósito. O modo API e o streaming funcionam,
// mas cada verificação consome cota de API do org, e essa cota é compartilhada
// por toda a empresa: sem um contrato que defina limites e responsabilidade,
// liberar isso para qualquer usuário derruba a integração de quem não pediu
// nada. A mecânica de ativação por empresa entra quando houver contrato.
//
// Religar é flipar aqui. Junto voltam as permissões opcionais no manifest
// (cookies + host do org), removidas enquanto o recurso está inalcançável.
//
// Carregado em três escopos isolados que não compartilham global:
// content script (manifest.json), página de opções (options.html) e service
// worker (importScripts em service-worker.js).
const ENTERPRISE_FEATURES = { apiMode: false, stream: false };
