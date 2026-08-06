# DentalSys 2.0 — Manual do Usuário

Sistema de gestão para consultórios odontológicos.

> Este arquivo é um dos módulos do manual. Consulte o sumário em `manual/INDEX.md`.

---


## 8. Cobrança Online (Pix, Boleto e Cartão)

Gerada pelo botão **Cobrança** em um lançamento de receita pendente.

**Passo a passo:**
1. Abra o modal de cobrança (o valor vem do lançamento).
2. Escolha a forma: **Pix**, **Boleto** ou **Cartão**.

**Pix:**
- É exibido o **QR Code** e o código **Pix copia e cola**; use **Copiar** para enviar ao cliente.

**Boleto:**
- Veja a **Linha digitável** (use **Copiar**) e o link **Abrir boleto**.

**Cartão:**
- Preencha **Nome impresso no cartão**, **Número**, **Validade (MM/AAAA)**, **CVV** e escolha as **Parcelas**.
- Clique em **Gerar cobrança**. Se aprovado, o lançamento é baixado automaticamente (aparece "Pagamento aprovado").

**Modo de operação:**
- Sem credenciais do gateway configuradas, a cobrança é gerada em **modo simulação** (com aviso visual). Ao configurar as credenciais reais em Configurações → Gateway de pagamento, as cobranças passam a ser reais.
- Para cobrança não confirmada na hora (Pix/Boleto), use **Marcar como pago** quando o pagamento for confirmado.

**Webhook (receber confirmação automática):**
- Se configurado em Configurações, o servidor recebe a confirmação do gateway automaticamente e baixa o lançamento. (Sujeito à configuração de **Webhook Secret** e **IP permitido**.)

---

