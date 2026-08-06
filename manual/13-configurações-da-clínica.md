# DentalSys 2.0 — Manual do Usuário

Sistema de gestão para consultórios odontológicos.

> Este arquivo é um dos módulos do manual. Consulte o sumário em `manual/INDEX.md`.

---


## 13. Configurações da Clínica

- **Dados gerais:** nome fantasia, razão social, CNPJ, responsável, contato/endereço.
- **Gateway de pagamento:**
  - **Ambiente** (Sandbox/Produção), **Client ID**, **Client Secret**, **Chave Pix**.
  - **Webhook Secret** e **IP permitido** (para a confirmação automática de pagamentos).
  - **Ativar gateway** para usar credenciais reais (sem ativa, tudo fica em modo simulação).
- Apenas o **administrador** (`config.editar`) pode salvar essas configurações.

---


**Captura de tela:**

![13-configuracoes](manual/capturas/13-configuracoes.png)
