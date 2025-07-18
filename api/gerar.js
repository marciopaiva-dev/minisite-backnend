
export default function handler(req, res) {
  if (req.method === 'POST') {
    return res.status(200).send('Mini site gerado (simulado).');
  } else {
    return res.status(405).send('Método não permitido');
  }
}
