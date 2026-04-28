import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { texto } = await req.json()
  if (!texto) return NextResponse.json({ erro: 'Texto obrigatório.' }, { status: 400 })

  const key = process.env.GOOGLE_TTS_KEY
  if (!key) return NextResponse.json({ erro: 'TTS não configurado.' }, { status: 500 })

  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: texto },
        voice: {
          languageCode: 'pt-BR',
          name: 'pt-BR-Neural2-A', // Voz feminina neural — mais natural
          ssmlGender: 'FEMALE',
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 0.92,
          pitch: 0.0,
        },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json()
    return NextResponse.json({ erro: err.error?.message ?? 'Erro no TTS.' }, { status: 500 })
  }

  const data = await res.json()
  return NextResponse.json({ audio: data.audioContent }) // base64 MP3
}
