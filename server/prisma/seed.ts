import bcrypt from "bcryptjs";
import prisma from "../src/config/database";

async function main() {
  const adminExiste = await prisma.usuario.findUnique({
    where: { email: "admin@dentalsys.com" },
  });

  if (adminExiste) {
    console.log("Seed já aplicado anteriormente. Pulando.");
    return;
  }

  const clinica = await prisma.clinica.create({
    data: {
      nome: "Clínica Demo",
      cnpj: "00.000.000/0001-00",
      email: "demo@dentalsys.com",
      razaoSocial: "Clínica Demo Odontológica LTDA",
      responsavel: "Dr. Ana Souza",
      endereco: "Av. Paulista, 1000 - São Paulo/SP",
      telefone: "(11) 3000-0000",
    },
  });

  const senhaHash = await bcrypt.hash("admin123", 10);
  await prisma.usuario.create({
    data: {
      clinicaId: clinica.id,
      nome: "Administrador",
      email: "admin@dentalsys.com",
      senhaHash,
      cargo: "administrador",
    },
  });

  const dentista = await prisma.usuario.create({
    data: {
      clinicaId: clinica.id,
      nome: "Dr. Carlos Lima",
      email: "dr.carlos@dentalsys.com",
      senhaHash,
      cargo: "dentista",
    },
  });

  await prisma.profissional.create({
    data: {
      clinicaId: clinica.id,
      usuarioId: dentista.id,
      nome: "Dr. Carlos Lima",
      cro: "SP 45.678",
      especialidade: "Ortodontia",
      horarioAtendimento: "Seg-Sex 08:00-17:00",
      comissao: 40,
    },
  });

  const recepcionista = await prisma.usuario.create({
    data: {
      clinicaId: clinica.id,
      nome: "Maria Recepção",
      email: "recepcao@dentalsys.com",
      senhaHash,
      cargo: "recepcionista",
    },
  });

  const paciente = await prisma.paciente.create({
    data: {
      clinicaId: clinica.id,
      nome: "João da Silva",
      cpf: "123.456.789-00",
      dataNascimento: new Date("1990-05-12"),
      telefone: "(11) 99999-0000",
      whatsapp: "(11) 98888-1111",
      email: "joao@email.com",
      endereco: "Rua das Flores, 123 - São Paulo/SP",
      contatoEmergencial: "Maria da Silva - (11) 97777-2222",
      alergias: "Penicilina, lidocaína",
      indicacao: "Indicado pelo Dr. Carlos",
      observacoes: "Paciente com medo de agulha",
    },
  });

  await prisma.prontuario.create({
    data: {
      clinicaId: clinica.id,
      pacienteId: paciente.id,
      titulo: "Primeira consulta",
      conteudo: "Avaliação inicial, sem queixas relevantes. Encaminhado para limpeza.",
      tipo: "evolucao",
    },
  });

  const convenioAmil = await prisma.convenio.create({
    data: {
      clinicaId: clinica.id,
      nome: "Amil Dental",
      registro: "325410",
      telefone: "0800 123 4567",
    },
  });

  await prisma.paciente.update({
    where: { id: paciente.id },
    data: { convenioId: convenioAmil.id },
  });

  await prisma.convenio.create({
    data: {
      clinicaId: clinica.id,
      nome: "Unimed Odonto",
      registro: "412098",
      telefone: "0800 765 4321",
    },
  });

  const limpeza = await prisma.procedimento.create({
    data: {
      clinicaId: clinica.id,
      nome: "Limpeza / Profilaxia",
      codigoTuss: "11001017",
      valorParticular: 180,
      duracaoMedia: 40,
    },
  });

  await prisma.procedimento.create({
    data: {
      clinicaId: clinica.id,
      nome: "Restauração em Resina",
      codigoTuss: "21003021",
      valorParticular: 320,
      duracaoMedia: 45,
    },
  });

  await prisma.procedimento.create({
    data: {
      clinicaId: clinica.id,
      nome: "Canal / Endodontia",
      codigoTuss: "41001010",
      valorParticular: 850,
      duracaoMedia: 90,
    },
  });

  await prisma.convenioProcedimento.create({
    data: {
      convenioId: convenioAmil.id,
      procedimentoId: limpeza.id,
      valor: 120,
    },
  });

  const salaL1 = await prisma.sala.create({
    data: { clinicaId: clinica.id, nome: "Consultório 1" },
  });
  await prisma.sala.create({
    data: { clinicaId: clinica.id, nome: "Consultório 2" },
  });
  await prisma.sala.create({
    data: { clinicaId: clinica.id, nome: "Raio-X" },
  });

  const hoje = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const amanhaDate = new Date(hoje.getTime() + 86400000);

  const hoje9h = new Date(`${fmt(hoje)}T09:00:00-03:00`);
  const hoje14h = new Date(`${fmt(hoje)}T14:00:00-03:00`);
  const amanha = new Date(`${fmt(amanhaDate)}T09:00:00-03:00`);
  const amanha11h = new Date(`${fmt(amanhaDate)}T11:00:00-03:00`);

  await prisma.agendamento.create({
    data: {
      clinicaId: clinica.id,
      pacienteId: paciente.id,
      profissionalId: (await prisma.profissional.findFirst({ where: { clinicaId: clinica.id } }))!.id,
      salaId: salaL1.id,
      procedimentoId: limpeza.id,
      dataHora: hoje9h,
      duracaoMin: 40,
      status: "confirmado",
      observacoes: "Limpeza de rotina",
    },
  });

  await prisma.agendamento.create({
    data: {
      clinicaId: clinica.id,
      pacienteId: paciente.id,
      profissionalId: (await prisma.profissional.findFirst({ where: { clinicaId: clinica.id } }))!.id,
      salaId: salaL1.id,
      dataHora: hoje14h,
      duracaoMin: 30,
      status: "agendado",
      observacoes: "Avaliação inicial",
    },
  });

  await prisma.agendamento.create({
    data: {
      clinicaId: clinica.id,
      pacienteId: paciente.id,
      profissionalId: (await prisma.profissional.findFirst({ where: { clinicaId: clinica.id } }))!.id,
      procedimentoId: limpeza.id,
      dataHora: amanha,
      duracaoMin: 40,
      status: "agendado",
      observacoes: "Retorno de avaliação",
    },
  });

  await prisma.agendamento.create({
    data: {
      clinicaId: clinica.id,
      profissionalId: (await prisma.profissional.findFirst({ where: { clinicaId: clinica.id } }))!.id,
      dataHora: amanha11h,
      duracaoMin: 30,
      status: "bloqueado",
      observacoes: "Horário de almoço",
    },
  });

  const profissionalDemo = (await prisma.profissional.findFirst({ where: { clinicaId: clinica.id } }))!;

  const dentesDemo = [16, 26, 36, 11];
  for (const numero of dentesDemo) {
    await prisma.odontogramaDente.upsert({
      where: { pacienteId_numero: { pacienteId: paciente.id, numero } },
      update: {},
      create: {
        clinicaId: clinica.id,
        pacienteId: paciente.id,
        numero,
        condicao: numero === 36 ? "restauracao" : "carie",
        observacao: numero === 36 ? "Restauração em resina na oclusal" : "Cárie proximal detectada na avaliação",
      },
    });
  }

  await prisma.evolucao.create({
    data: {
      clinicaId: clinica.id,
      pacienteId: paciente.id,
      profissionalId: profissionalDemo.id,
      descricao:
        "Paciente compareceu para primeira consulta. Queixa de sensibilidade em dentes posteriores superiores. Ao exame clínico, observada cárie proximal em dentes 16 e 26.",
      conduta: "Orientado higiene bucal, agendada restauração para próxima sessão.",
      criadoEm: new Date(`${fmt(amanhaDate)}T10:30:00-03:00`),
    },
  });

  await prisma.exame.create({
    data: {
      clinicaId: clinica.id,
      pacienteId: paciente.id,
      tipo: "laudo",
      descricao: "Laudo da radiografia panorâmica: ausência de lesões periapicais visíveis.",
    },
  });

  await prisma.receituario.create({
    data: {
      clinicaId: clinica.id,
      pacienteId: paciente.id,
      profissionalId: profissionalDemo.id,
      medicamentos: JSON.stringify([
        { nome: "Nimesulida 100mg", posologia: "1 comprimido a cada 12h por 5 dias", quantidade: "1 caixa" },
        { nome: "Digluconato de Clorexidina 0,12%", posologia: "Bochechar 15mL por 30s, 2x ao dia", quantidade: "1 frasco" },
      ]),
      instrucoes: "Tomar a medicação após as refeições.",
      assinatura: profissionalDemo.nome,
    },
  });

  const receitaLimpeza = await prisma.lancamento.create({
    data: {
      clinicaId: clinica.id,
      tipo: "receita",
      descricao: "Limpeza / Profilaxia",
      valor: 180,
      formaPagamento: "pix",
      status: "pago",
      pacienteId: paciente.id,
      profissionalId: profissionalDemo.id,
      procedimentoId: limpeza.id,
      dataVencimento: new Date(`${fmt(amanhaDate)}T00:00:00-03:00`),
      dataPagamento: new Date(`${fmt(amanhaDate)}T11:00:00-03:00`),
    },
  });

  const comissao = Number(profissionalDemo.comissao || 0);
  if (comissao > 0) {
    await prisma.comissao.create({
      data: {
        clinicaId: clinica.id,
        lancamentoId: receitaLimpeza.id,
        profissionalId: profissionalDemo.id,
        percentual: comissao,
        valor: Math.round((180 * comissao) / 100 * 100) / 100,
        paga: false,
      },
    });
  }

  await prisma.lancamento.create({
    data: {
      clinicaId: clinica.id,
      tipo: "receita",
      descricao: "Restauração em Resina",
      valor: 320,
      formaPagamento: "cartao_credito",
      status: "pendente",
      pacienteId: paciente.id,
      profissionalId: profissionalDemo.id,
      procedimentoId: (await prisma.procedimento.findFirst({
        where: { clinicaId: clinica.id, nome: "Restauração em Resina" },
      }))!.id,
      dataVencimento: new Date(`${fmt(hoje)}T00:00:00-03:00`),
    },
  });

  await prisma.lancamento.create({
    data: {
      clinicaId: clinica.id,
      tipo: "despesa",
      descricao: "Material de consumo",
      valor: 85.5,
      formaPagamento: "cartao_debito",
      status: "pendente",
      dataVencimento: new Date(`${fmt(hoje)}T00:00:00-03:00`),
    },
  });

  console.log("Seed concluído.");
  console.log("  admin@dentalsys.com    / admin123   (administrador)");
  console.log("  dr.carlos@dentalsys.com / admin123   (dentista)");
  console.log("  recepcao@dentalsys.com / admin123   (recepcionista)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
