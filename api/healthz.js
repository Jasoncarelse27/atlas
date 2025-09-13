// Vercel API route for health check at /healthz
export default function handler(req, res) {
  res.status(200).json({
    status: 'ok'
  });
}