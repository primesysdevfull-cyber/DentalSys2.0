# DentalSys 2.0

Sistema de gestão para clínicas odontológicas integrado à nuvem (modelo SaaS multi-tenant), desenvolvido em módulos.

## Stack

- **Frontend:** React 18 + Vite + TypeScript + React Router
- **Backend:** Node.js + Express + TypeScript
- **Banco:** PostgreSQL + Prisma ORM
- **Auth:** JWT com isolamento por clínica (multi-tenant) e permissões por cargo
- **Infra:** Docker Compose (Postgres + API + Web)

## Estrutura

```
dentalSys2.0/
├── docker-compose.yml
├── server/          # API REST (Express + Prisma)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   └── testes.ts      # testes de integração (dados/regras)
│   └── src/
│       ├── modules/       # um módulo por pasta
│       │   ├── auth/
│       │   ├── pacientes/
│       │   ├── profissionais/
│       │   ├── procedimentos/
│       │   ├── convenios/
│       │   ├── clinica/
│       │   └── usuarios/
│       ├── config/        # banco + matriz de permissões
│       └── middleware/
└── client/          # Frontend React
    └── src/
        ├── pages/
        ├── components/
        ├── services/
        ├── api/
        └── context/       # PermissãoContext (controle de acesso na UI)
```

## Como rodar

Pré-requisito: Docker e Docker Compose instalados.

```bash
docker compose up --build
```

- API: http://localhost:3333 (health em `/health`)
- Web: http://localhost:5173
- Banco: porta **5433** (evita conflito com Postgres local na 5432)

### Acessos de demonstração (criados pelo seed)

| Perfil | Email | Senha |
|--------|-------|-------|
| Administrador | admin@dentalsys.com | admin123 |
| Dentista | dr.carlos@dentalsys.com | admin123 |
| Recepcionista | recepcao@dentalsys.com | admin123 |

### Rodando sem Docker (desenvolvimento)

```bash
# terminal 1 - banco (substitua credenciais do .env se já tiver Postgres)
docker compose up db

# terminal 2 - API
cd server
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev

# terminal 3 - Web
cd client
npm install
npm run dev
```

## Testes

Após cada módulo, rodamos a suíte de testes:

```bash
cd server
npx tsc --noEmit          # typecheck
npx tsx prisma/testes.ts  # testes de integração do banco (regras e isolamento)
npm run test              # testes HTTP de integração (vitest) — exige a API rodando
```

- **testes.ts:** valida matriz de permissões, isolamento multi-tenant, valores por convênio, novos campos e vínculos.
- **Testes HTTP:** login, CRUD de pacientes/profissionais/procedimentos/convênios, agenda, notas fiscais e permissões por cargo (403 para ações não autorizadas).

## Mensagens (WhatsApp)

A confirmação de agendamento envia a mensagem via API compatível com a **Evolution API**. Sem configuração, o envio é **simulado** (resposta do sistema sem provedor real).

```env
WHATSAPP_API_URL=http://localhost:8080        # base da API (ex.: Evolution API)
WHATSAPP_API_TOKEN=seu-token
WHATSAPP_INSTANCE=nome-da-instancia
```

O número do paciente (WhatsApp ou telefone) é normalizado automaticamente para o formato internacional (`55...`).

## Notas Fiscais

O sistema emite **NFS-e** (serviço) e **NF-e** (produto) de três formas:

- **Emissor próprio:** gera o XML (ABRASF municipal **ou** Ambiente Nacional NFS-e) e transmite via SOAP com certificado digital A1. A configuração é feita **por clínica** (Notas Fiscais → Integrações → Emissor próprio): upload do certificado `.pfx`, muniícipio/UF/IBGE, inscrição municipal, padrão do webservice e endpoints de homologação e produção. Sem essa configuração, a transmissão é **simulada** (status `loteEnviado`).

- **Tiny:** envia a nota para a API do Tiny (`nota.servico.incluir.php` para NFS-e). Configure o **token** da API Tiny na tela de Notas Fiscais → Integrações.
- **Bling:** cria a nota via API v3 (`POST /notas-de-servicos`) e transmite (`/enviar`). Configure o **access token** (OAuth2) na tela de Notas Fiscais → Integrações.

Cada nota guarda status (`rascunho`, `loteEnviado`, `autorizada`, `rejeitada`, `cancelada`), número sequencial, protocolo, número da NFS-e no município e mensagem de retorno.

### Emissor próprio — padrão ABRASF municipal vs Ambiente Nacional

O campo **"Padrão / webservice"** na configuração do emissor próprio define qual layout/webservice é usado:

- **ABRASF municipal:** gera o XML no padrão ABRASF clássico e transmite ao endpoint informado pela prefeitura (ex.: `https://homologacao.prefeitura.gov.br/nfse`). Cada município tem seu WS e extensões próprias.
- **Ambiente Nacional NFS-e (LC 214/2025):** gera o XML no layout nacional — serviço síncrono `EnviarLoteRpsSincronoEnvio`, namespace `https://www.nfse.gov.br/NFSE`, com blocos `TributacaoNacional`/`Cbs`/`Ibs` e `CodigoServicoNacional`. Endpoints de homologação/produção do Ambiente Nacional. Obrigatório como padrão nacional a partir de **01/01/2026**.

### Fluxo de homologação do emissor próprio

1. **Pré-requisitos:** certificado digital **A1** (PCR A1), inscrição municipal ativa e código de serviço/alíquota ISS da lista de serviços.
2. **Município com webservice próprio (ABRASF):** a prefeitura fornece os WSDLs de homologação e produção. Cadastre os endpoints no campo **Endpoint homologação/produção** e defina o padrão **ABRASF municipal**.
3. **Município aderido ao Ambiente Nacional:** use o padrão **Ambiente Nacional NFS-e** e os endpoints nacionais de homologação/produção disponibilizados pelo sistema nacional.
4. Suba o certificado `.pfx`, preencha município/UF/**IBGE**/**inscrição municipal**, selecione o **ambiente** e habilite "Emissão real".
5. Na tela Notas Fiscais, emita uma nota. Em homologação espere retorno aceito pelo fisco; em produção, verifique a autorização e o DANFE/XML.

### Como obter o token de acesso (OAuth2) do Bling

A integração Bling v3 exige um **access token** OAuth2 (não a antiga API key). Para obtê-lo:

1. Acesse **https://www.bling.com.br** → **Preferências → Integrações → Criar app** (ou via `https://www.bling.com.br/contatos/integracoes-apis`).
2. Cadastre a **URL de redirecionamento** no app (o endereço público onde o sistema receberá o callback, ex.: `https://app.dentalsys.com/callback` — em desenvolvimento pode ser `http://localhost:5173`).
3. Anote o **Client ID** e **Client Secret** gerados e selecione os **escopos** (para NFS-e: `notas_de_servicos`; inclua `contas_pagar/receber` se for sincronizar financeiro).
4. Gere a URL de autorização `https://www.bling.com.br/OAuth/authorize?response_type=code&client_id={ClientId}&state=nonce` e **acoce como administrador do app**. Você será redirecionado com um `?code=` temporário.
5. Troque esse `code` por tokens: `POST https://www.bling.com.br/Api/v3/oauth/token` com corpo `grant_type=authorization_code&code=...` e **Basic Auth** (ClientId:ClientSecret). A resposta retorna `access_token` (expira em **6 horas**) e `refresh_token` (expira em **normalmente 90 dias**, reutilizável).
6. Cole o `access_token` na tela **Notas Fiscais → Integrações** (campo "Access token Bling v3"). Para uso contínuo, mantenha um fluxo de **refresh** (trocar `refresh_token` por novo par) antes da expiração, pois o Bling invalida o access token ao renovar.

> Nota: o Bling concentra o certificado A1 internamente; o app aqui usa apenas o token OAuth2.

## Módulos

| Módulo      | Status | Descrição |
|-------------|--------|-----------|
| Cadastros   | ✅ | Pacientes, Profissionais (CRO/comissão), Procedimentos (TUSS/valor por convênio), Convênios, Configurações da Clínica, Usuários e Permissões |
| Autenticação | ✅ | Login, registro de clínica, multi-tenant, permissões por cargo |
| Agendamento | ✅ | Agenda (dia/semana/mês), salas, bloqueio de horário, retorno, histórico, confirmação |
| Financeiro  | ✅ | Lançamentos, baixa/cancelamento, comissões, resumo e relatórios |
| Dashboard e Relatórios | ✅ | Painel, relatórios de atendimentos/pacientes/financeiro com exportação CSV e impressão PDF |
| Mensagens   | ✅ | Confirmações de agendamento (contato do paciente) |
| Importação/Exportação | ✅ | Importar e exportar pacientes em CSV |
| Notas Fiscais | ✅ | Emissão de NFS-e/NF-e com emissor próprio (transmissão à prefeitura) e integração Tiny/Bling |

### Permissões por cargo

- **Administrador:** acesso total.
- **Dentista:** vê e edita pacientes e prontuário clínico; não exclui nem gerencia usuários.
- **Recepcionista:** cadastra e edita pacientes; **não vê prontuário clínico** e não exclui registros.

## API principal

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/registro` | Criar clínica + admin |
| GET | `/api/usuarios/me` | Cargo e permissões do usuário logado |
| GET/POST | `/api/pacientes` | Listar/criar pacientes (`?busca=`) |
| GET/PUT/DELETE | `/api/pacientes/:id` | Detalhe/atualizar/excluir |
| GET/POST | `/api/pacientes/exportar` · `/api/pacientes/importar` | Exportar/importar pacientes em CSV |
| POST/DELETE | `/api/pacientes/:id/prontuarios` | Prontuário (apenas dentista/admin) |
| GET/POST | `/api/profissionais` | Listar/criar profissionais (cria usuário vinculado) |
| GET/POST | `/api/procedimentos` | Listar/criar procedimentos |
| PUT | `/api/procedimentos/:id/convenios/valor` | Valor por convênio |
| GET/POST | `/api/convenios` | Listar/criar convênios |
| GET/PUT | `/api/clinica` | Configurações da clínica |
| GET/POST/PUT | `/api/usuarios` | Gestão de usuários (admin) |
| GET/POST/PUT/DELETE | `/api/agenda` | Agendamentos (lista, criar, editar, excluir; `?inicio=&fim=`) |
| GET/POST | `/api/agenda/:id/status` · `/confirmar` · `/retorno` | Mudar status, confirmar, marcar retorno |
| POST | `/api/agenda/bloquear` | Bloquear horário |
| GET | `/api/agenda/historico` | Histórico de atendimentos |
| GET/POST | `/api/salas` | Gerenciar salas |
| GET/POST | `/api/financeiro/lancamentos` | Listar/criar lançamentos |
| POST/PUT | `/api/financeiro/lancamentos/:id` | Baixar/cancelar/editar lançamentos |
| GET | `/api/financeiro/resumo` · `/comissoes` | Resumo financeiro e comissões |
| GET | `/api/dashboard/resumo` · `/relatorio` | Painel e relatório da agenda |
| GET/POST | `/api/notas-fiscais` | Listar/criar notas fiscais |
| POST | `/api/notas-fiscais/:id/emitir` · `/cancelar` | Emitir/cancelar nota |
| GET/PUT | `/api/notas-fiscais/integracoes` | Integrações Tiny/Bling |
| GET/PUT | `/api/notas-fiscais/config/nfse` | Config do emissor próprio (município, endpoints, certificado) |
