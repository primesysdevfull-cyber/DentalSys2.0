import prisma from "../src/config/database";
import { temPermissao } from "../src/config/permissoes";

async function main() {
  let passou = 0;
  let falhou = 0;

  const sufixo = String(Date.now()).slice(-6);
  const cnpj1 = `11.${sufixo}/0001-11`;
  const cnpj2 = `22.${sufixo}/0001-22`;
  const email1 = `a${sufixo}@teste.com`;
  const email2 = `b${sufixo}@teste.com`;

  function check(nome: string, cond: boolean) {
    if (cond) {
      passou++;
      console.log(`  ✔ ${nome}`);
    } else {
      falhou++;
      console.error(`  ✘ ${nome}`);
    }
  }

  console.log("\n1. Permissões por cargo");
  check("admin gerencia tudo", temPermissao("administrador", "prontuario.ver"));
  check("admin exclui pacientes", temPermissao("administrador", "pacientes.excluir"));
  check("dentista vê prontuário", temPermissao("dentista", "prontuario.ver"));
  check("dentista NÃO exclui paciente", !temPermissao("dentista", "pacientes.excluir"));
  check("recepcionista NÃO vê prontuário", !temPermissao("recepcionista", "prontuario.ver"));
  check("recepcionista cadastra paciente", temPermissao("recepcionista", "pacientes.criar"));
  check("admin agenda tudo", temPermissao("administrador", "agenda.criar"));
  check("dentista atende agenda", temPermissao("dentista", "agenda.atender"));
  check("recepcionista agenda", temPermissao("recepcionista", "agenda.criar"));
  check("recepcionista NÃO exclui agenda", !temPermissao("recepcionista", "agenda.excluir"));
  check("recepcionista NÃO gerencia salas", !temPermissao("recepcionista", "salas.gerenciar"));
  check("todos os cargos veem dashboard", temPermissao("administrador", "dashboard.ver") && temPermissao("dentista", "dashboard.ver") && temPermissao("recepcionista", "dashboard.ver"));

  console.log("\n2. Isolamento multi-tenant");
  const clinica1 = await prisma.clinica.create({
    data: { nome: "Clínica Teste A", cnpj: cnpj1, email: email1 },
  });
  const clinica2 = await prisma.clinica.create({
    data: { nome: "Clínica Teste B", cnpj: cnpj2, email: email2 },
  });
  const p1 = await prisma.paciente.create({
    data: { clinicaId: clinica1.id, nome: "Paciente A", cpf: "111.111.111-11" },
  });
  await prisma.paciente.create({
    data: { clinicaId: clinica2.id, nome: "Paciente B", cpf: "222.222.222-22" },
  });
  const p1NaClinica2 = await prisma.paciente.findFirst({ where: { id: p1.id, clinicaId: clinica2.id } });
  check("paciente da clínica A invisível para clínica B", p1NaClinica2 === null);

  console.log("\n3. Valor por convênio");
  const proc = await prisma.procedimento.create({
    data: { clinicaId: clinica1.id, nome: "Teste", codigoTuss: "999", valorParticular: 200, duracaoMedia: 30 },
  });
  const conv = await prisma.convenio.create({ data: { clinicaId: clinica1.id, nome: "Conv Teste" } });
  await prisma.convenioProcedimento.create({ data: { convenioId: conv.id, procedimentoId: proc.id, valor: 150 } });
  const cp = await prisma.convenioProcedimento.findUnique({
    where: { convenioId_procedimentoId: { convenioId: conv.id, procedimentoId: proc.id } },
  });
  check("valor por convênio gravado (R$ 150)", Number(cp?.valor) === 150);

  console.log("\n4. Novo campo Paciente (alergias/contato emergencial)");
  const pCompleto = await prisma.paciente.create({
    data: {
      clinicaId: clinica1.id,
      nome: "Paciente Completo",
      alergias: "Penicilina",
      contatoEmergencial: "Maria - (11) 99999-9999",
      indicacao: "Dr. João",
      whatsapp: "(11) 98888-8888",
    },
  });
  check(
    "campos obrigatórios do plano gravados",
    pCompleto.alergias === "Penicilina" && pCompleto.contatoEmergencial !== null && pCompleto.indicacao === "Dr. João" && pCompleto.whatsapp !== null
  );

  console.log("\n5. Profissional vincula usuário");
  const usuarioTeste = await prisma.usuario.create({
    data: {
      clinicaId: clinica1.id,
      nome: "Dr Teste",
      email: `dr.teste${sufixo}@teste.com`,
      senhaHash: "x",
      cargo: "dentista",
    },
  });
  await prisma.profissional.create({
    data: {
      clinicaId: clinica1.id,
      usuarioId: usuarioTeste.id,
      nome: "Dr Teste",
      cro: "SP 0001",
      comissao: 40,
    },
  });
  const prof = await prisma.profissional.findFirst({
    where: { clinicaId: clinica1.id },
    include: { usuario: true },
  });
  check("profissional criado", prof !== null);
  check("profissional vincula usuário com cargo dentista", prof?.usuario.cargo === "dentista");
  check("comissão do profissional = 40%", Number(prof?.comissao) === 40);

  console.log("\n6. Cascade prontuário");
  const pront = await prisma.prontuario.findFirst({ where: { pacienteId: pCompleto.id } });
  check("paciente sem prontuário inicialmente", pront === null);

  console.log("\n7. Agenda e Atendimento");
  const salaA = await prisma.sala.create({ data: { clinicaId: clinica1.id, nome: "Sala Teste A" } });
  await prisma.sala.create({ data: { clinicaId: clinica2.id, nome: "Sala Teste B" } });
  check("sala criada", salaA !== null);

  const prof1 = await prisma.profissional.findFirst({ where: { clinicaId: clinica1.id } });
  const agInicio = new Date();
  agInicio.setHours(10, 0, 0, 0);

  const ag1 = await prisma.agendamento.create({
    data: {
      clinicaId: clinica1.id,
      pacienteId: p1.id,
      profissionalId: prof1!.id,
      salaId: salaA.id,
      dataHora: agInicio,
      duracaoMin: 30,
      status: "agendado",
      observacoes: "Consulta de teste",
    },
  });
  check("agendamento criado com status agendado", ag1.status === "agendado");

  const salaDeOutraClinica = await prisma.sala.findFirst({ where: { clinicaId: clinica2.id } });
  const salaFiltrada = await prisma.sala.findFirst({ where: { id: salaDeOutraClinica!.id, clinicaId: clinica1.id } });
  check("sala da clínica B invisível para clínica A", salaFiltrada === null);

  const conflitoInicio = new Date(agInicio.getTime() + 10 * 60000);
  const conflito = await prisma.agendamento.create({
    data: {
      clinicaId: clinica1.id,
      pacienteId: p1.id,
      profissionalId: prof1!.id,
      dataHora: conflitoInicio,
      duracaoMin: 30,
      status: "agendado",
    },
  });
  check("agendamento com sobreposição permitido no banco (validação é no controller)", conflito.id !== undefined);

  await prisma.agendamento.update({ where: { id: ag1.id }, data: { status: "confirmado" } });
  const agConfirmado = await prisma.agendamento.findUnique({ where: { id: ag1.id } });
  check("status mudou para confirmado", agConfirmado?.status === "confirmado");

  await prisma.agendamento.update({ where: { id: ag1.id }, data: { status: "atendido", ehRetorno: true } });
  const retorno = await prisma.agendamento.create({
    data: {
      clinicaId: clinica1.id,
      pacienteId: p1.id,
      profissionalId: prof1!.id,
      dataHora: new Date(agInicio.getTime() + 7 * 86400000),
      duracaoMin: 30,
      status: "agendado",
      ehRetorno: true,
      agendamentoOrigemId: ag1.id,
    },
  });
  check("retorno vinculado ao atendimento original", retorno.agendamentoOrigemId === ag1.id);

  const bloqueio = await prisma.agendamento.create({
    data: {
      clinicaId: clinica1.id,
      profissionalId: prof1!.id,
      salaId: salaA.id,
      dataHora: new Date(agInicio.getTime() + 3 * 3600000),
      duracaoMin: 60,
      status: "bloqueado",
      observacoes: "Almoço",
    },
  });
  check("bloqueio de horário criado sem paciente", bloqueio.pacienteId === null && bloqueio.status === "bloqueado");

  const historico = await prisma.agendamento.findMany({
    where: { clinicaId: clinica1.id, status: { in: ["atendido", "faltou"] } },
  });
  check("histórico lista atendidos", historico.some((h) => h.status === "atendido"));

  console.log("\n8. Financeiro e Comissões");
  const lancamento = await prisma.lancamento.create({
    data: {
      clinicaId: clinica1.id,
      tipo: "receita",
      descricao: "Restauração em Resina",
      valor: 320,
      formaPagamento: "pix",
      pacienteId: p1.id,
      profissionalId: prof1!.id,
      status: "pendente",
      dataVencimento: new Date(),
    },
  });
  check("receita criada pendente", lancamento.status === "pendente" && Number(lancamento.valor) === 320);

  const comissao = await prisma.comissao.create({
    data: {
      clinicaId: clinica1.id,
      lancamentoId: lancamento.id,
      profissionalId: prof1!.id,
      percentual: 40,
      valor: 128,
      paga: false,
    },
  });
  check("comissão criada a partir da receita", Number(comissao.valor) === 128 && comissao.paga === false);

  const despesa = await prisma.lancamento.create({
    data: {
      clinicaId: clinica1.id,
      tipo: "despesa",
      descricao: "Material de consumo",
      valor: 85.5,
      formaPagamento: "cartao_debito",
      status: "pendente",
      dataVencimento: new Date(),
    },
  });
  check("despesa criada pendente", despesa.tipo === "despesa" && Number(despesa.valor) === 85.5);

  const baixado = await prisma.lancamento.update({
    where: { id: lancamento.id },
    data: { status: "pago", dataPagamento: new Date() },
  });
  check("receita baixada para pago", baixado.status === "pago" && baixado.dataPagamento !== null);

  const resumo = await prisma.lancamento.aggregate({
    where: { clinicaId: clinica1.id, tipo: "receita", status: "pago" },
    _sum: { valor: true },
  });
  check("resumo soma receitas pagas", Number(resumo._sum.valor || 0) === 320);

  await prisma.comissao.deleteMany({ where: { clinicaId: { in: [clinica1.id, clinica2.id] } } });
  await prisma.lancamento.deleteMany({ where: { clinicaId: { in: [clinica1.id, clinica2.id] } } });

  await prisma.agendamento.deleteMany({ where: { clinicaId: { in: [clinica1.id, clinica2.id] } } });
  await prisma.sala.deleteMany({ where: { clinicaId: { in: [clinica1.id, clinica2.id] } } });
  await prisma.paciente.deleteMany({ where: { clinicaId: { in: [clinica1.id, clinica2.id] } } });
  await prisma.procedimento.deleteMany({ where: { clinicaId: { in: [clinica1.id, clinica2.id] } } });
  await prisma.convenio.deleteMany({ where: { clinicaId: { in: [clinica1.id, clinica2.id] } } });
  await prisma.profissional.deleteMany({ where: { clinicaId: { in: [clinica1.id, clinica2.id] } } });
  await prisma.usuario.deleteMany({ where: { clinicaId: { in: [clinica1.id, clinica2.id] } } });
  await prisma.clinica.deleteMany({
    where: { id: { in: [clinica1.id, clinica2.id] } },
  });

  console.log(`\n=== Resultado: ${passou} aprovados, ${falhou} falhas ===\n`);
  process.exit(falhou > 0 ? 1 : 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
