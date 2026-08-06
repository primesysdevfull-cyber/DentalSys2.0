# DentalSys 2.0 — Manual do Usuário

Sistema de gestão para consultórios odontológicos.

> Este arquivo é um dos módulos do manual. Consulte o sumário em `manual/INDEX.md`.

---


## 9. Mensagens

Abas: **Confirmações pendentes**, **Modelos de mensagens** e **Envio automático**.

**Enviar confirmação:**
- Na aba Confirmações pendentes, veja os atendimentos futuros sem confirmação enviada.
- Clique em **Enviar confirmação** (envia via WhatsApp se configurado e marca como confirmado).

**Modelos de mensagens:**
- Selecione o tipo (Confirmação, Lembrete, Retorno, Aniversário).
- Edite o **Texto do modelo** usando os **marcadores** `{{paciente}}`, `{{data}}`, `{{hora}}`, `{{profissional}}`, `{{procedimento}}`, `{{clinica}}`.
- Marque **Modelo ativo** para que seja usado nos envios automáticos.
- Clique em **Salvar modelo**.

**Envio automático:**
- Configure a **Antecedência do lembrete** (1h a 7 dias antes) e os tipos de envio (lembrete, retorno atrasado, aniversário).
- Clique em **Salvar configuração**.
- Use **Disparar agora** para executar um disparo imediato e ver o resumo.
- Acompanhe o **Histórico de envios** (filtrado por tipo), com status de envio.

> Para envio real de WhatsApp é preciso configurar o provedor (variável de ambiente `WHATSAPP_API_URL`). Sem isso, os envios ficam marcados como **simulados**.

---


**Captura de tela:**

![10-mensagens](manual/capturas/10-mensagens.png)
