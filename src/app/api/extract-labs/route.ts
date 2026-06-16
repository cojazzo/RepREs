import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    // Send the text to Ollama on the Proxmox Server via Tailscale VPN
    const OLLAMA_URL = 'http://100.125.127.8:11434/api/generate';
    
    const prompt = `You are a clinical data extraction assistant for the RepREs project. Your task is to find and extract the following specific laboratory values from the text below. The text is likely in Spanish.

Look for these exact targets (and map them to these exact Spanish names):
- Paciente (Nombre completo)
- Edad
- Sexo
- No. de expediente
- Leucocitos totales
- Neutrofilos %
- Linfocitos %
- Monocitos %
- Eosinofilos %
- Basofilos %
- Hemoglobina
- Hematocrito
- Plaquetas
- Glucosa
- BUN
- Urea
- Creatinina serica
- Acido urico
- Albumina serica
- Colesterol total
- Trigliceridos
- HDL
- LDL
- Indice aterogenico
- Complemento C3
- Complemento C4
- Sodio serico
- Potasio serico
- Cloro serico
- Fosforo
- Magnesio
- Calcio
- Cistatina C
- pH urinario
- Proteinas en tira
- Glucosa urinaria
- Sangre urinaria
- Nitritos
- Esterasa leucocitaria
- Bacterias
- Sodio urinario
- Potasio urinario
- Cloro urinario
- Creatinina urinaria
- Microalbumina
- Albumina urinaria
- Relacion Albumina/Creatinina (ACR)
- Insulina basal
- Vitamina D 25-OH

Return ONLY a valid JSON object. If a value is missing or not found in the text, just omit it. Use this exact structure:
{
  "Hemoglobina": { "value": 14.2, "unit": "g/dL" },
  "Creatinina serica": { "value": 1.1, "unit": "mg/dL" },
  "Relacion Albumina/Creatinina": { "value": 30, "unit": "mg/g" }
}

Do not include any explanations or markdown. ONLY raw JSON.

Text:
${text}`;

    const ollamaRes = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3',
        prompt: prompt,
        stream: false,
        format: 'json', // This forces Ollama to output valid JSON
        options: {
          num_ctx: 8192, // Massive context window so it reads the whole PDF
          temperature: 0.1 // Low temperature forces it to be analytical and not skip things
        }
      })
    });

    if (!ollamaRes.ok) {
      const errorText = await ollamaRes.text();
      return NextResponse.json({ error: 'Ollama API error: ' + errorText }, { status: ollamaRes.status });
    }

    const ollamaData = await ollamaRes.json();
    
    // Parse the JSON string returned by Llama 3
    let extractedData = {};
    try {
      extractedData = JSON.parse(ollamaData.response);
    } catch (e) {
      console.error("Failed to parse Ollama JSON:", ollamaData.response);
      return NextResponse.json({ error: 'AI returned invalid JSON', rawResponse: ollamaData.response }, { status: 500 });
    }

    return NextResponse.json({ extractedData: extractedData, rawText: text });

  } catch (error: any) {
    console.error('Extraction error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
