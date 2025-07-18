import fs from 'fs/promises';
import path from 'path';
import { Document, Packer, Paragraph, TextRun } from 'docx';

export async function POST(request) {
  const formData = await request.formData();
  const titulo = formData.get('titulo');
  const descricao = formData.get('descricao');
  const telefone = formData.get('telefone');

  const folder = path.join('/tmp/sites', titulo.toLowerCase().replace(/[^a-z0-9]/gi, '-'));
  await fs.mkdir(folder, { recursive: true });

  const htmlContent = `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${titulo}</title>
  <style>
    body {
      background-color: #0d1b2a;
      font-family: Arial, sans-serif;
      color: #fff;
      text-align: center;
      padding: 20px;
    }
    .box {
      background-color: #ffc300;
      color: #000;
      padding: 20px;
      border-radius: 12px;
      max-width: 400px;
      margin: 20px auto;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 12px;
      margin: 10px 0;
      border: none;
      font-size: 16px;
      font-weight: bold;
      border-radius: 8px;
      cursor: pointer;
      text-decoration: none;
    }
    .btn-proposta { background-color: #6b7280; color: #fff; }
    .btn-whatsapp { background-color: #22c55e; color: #fff; }
    footer { margin-top: 30px; font-size: 14px; color: #ffc300; }
  </style>
</head>
<body>
  <h1>${titulo}</h1>
  <div class="box">
    <p><strong>${descricao}</strong></p>
    <a class="btn btn-proposta" href="proposta-${titulo.toLowerCase().replace(/[^a-z0-9]/gi, '-')}.docx" download>BAIXAR PROPOSTA</a>
    <a class="btn btn-whatsapp" href="https://wa.me/55${telefone}?text=Olá! Tenho interesse no serviço de ${encodeURIComponent(titulo)}." target="_blank">
      FALE NO WHATSAPP
    </a>
  </div>
  <footer>Criado com ❤️ por Mini-Site com WhatsApp</footer>
</body>
</html>`;

  await fs.writeFile(path.join(folder, 'index.html'), htmlContent);

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          children: [
            new TextRun({ text: `Proposta de Serviço: ${titulo}`, bold: true, size: 28 }),
            new TextRun("\n\nDescrição: " + descricao),
            new TextRun("\n\nContato: " + telefone)
          ]
        })
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  await fs.writeFile(path.join(folder, `proposta-${titulo.toLowerCase().replace(/[^a-z0-9]/gi, '-')}.docx`), buffer);

  return new Response('MiniSite e proposta gerados com sucesso!');
}
