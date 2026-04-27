export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // १. निश्चित माहितीचा साठा (Predefined Knowledge Base)
    // यामुळे AI कॉल न होताच अचूक आणि मोफत उत्तर मिळेल.
    const PREDEFINED_KNOWLEDGE = {
        "उन्हाळा": "उन्हाळ्यात जास्तीत जास्त पाणी प्या, सुती कपडे वापरा आणि दुपारी १२ ते ४ दरम्यान बाहेर जाणे टाळा. लिंबू सरबत किंवा ताक पिणे फायदेशीर ठरते.",
        "पाणी": "दिवसभरात किमान ३-४ लिटर पाणी पिणे आवश्यक आहे. तहान लागण्याची वाट पाहू नका, दर तासाला थोडे थोडे पाणी पीत राहा.",
        "उष्माघात": "उष्माघाताची लक्षणे दिसल्यास (जसे की चक्कर येणे किंवा मळमळणे), त्वरित थंड ठिकाणी जा, अंगावर थंड पाण्याच्या घड्या ठेवा आणि डॉक्टरांशी संपर्क साधा.",
        "प्रदूषण": "बाहेर पडताना मास्क वापरा. घरी आल्यावर हात-पाय स्वच्छ धुवा आणि आहारात गुळाचा समावेश करा, ज्यामुळे फुफ्फुसे स्वच्छ राहण्यास मदत होते.",
        "पाऊस": "पावसाळ्यात पाणी उकळून प्या आणि बाहेरचे उघड्यावरचे पदार्थ खाणे टाळा. छत्री किंवा रेनकोट सोबत ठेवा."
    };

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const messages = body.messages || [];
        
        if (messages.length === 0) {
             return res.status(400).json({ error: 'No messages provided' });
        }

        const userQuery = messages[messages.length - 1].content.toLowerCase();
        
        const GEMINI_KEY = process.env.GOOGLE_API_KEY;
        const GROQ_KEY = process.env.GROQ_API_KEY;
        const systemInstruction = "तू 'ClimateGuard AI' आहेस. युजर ज्या भाषेत प्रश्न विचारेल, त्याच भाषेत उत्तर दे. उत्तर ३-४ ओळींत मर्यादित ठेव.";
        // २. 'Smart Keyword' शोध (API वाचवण्यासाठी)
        for (let key in PREDEFINED_KNOWLEDGE) {
            if (userQuery.includes(key)) {
                console.log("Found in Predefined Knowledge. Saving API call!");
                return res.status(200).json({ 
                    content: [{ type: 'text', text: PREDEFINED_KNOWLEDGE[key] }],
                    source: "Predefined" 
                });
            }
        }

        // ३. जर माहिती साठ्यात नसेल, तर Gemini (Best Marathi Model) कडे जाणे
        try {
            console.log("Attempting Gemini...");
            const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${systemInstruction}\nप्रश्न: ${userQuery}` }] }]
                })
            });

            const geminiData = await geminiRes.json();
            if (geminiData.candidates && geminiData.candidates[0].content) {
                return res.status(200).json({ 
                    content: [{ type: 'text', text: geminiData.candidates[0].content.parts[0].text }],
                    source: "Gemini"
                });
            } else {
                throw new Error("Gemini quota full");
            }

        } catch (geminiErr) {
            // ४. जर Gemini फेल झाले, तर Groq (Llama 3.1) - सर्वोत्तम बॅकअप
            console.log("Gemini failed, using Groq Fallback...");
            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [
                        { role: "system", content: systemInstruction },
                        { role: "user", content: userQuery }
                    ],
                    temperature: 0.5
                })
            });

            const groqData = await groqRes.json();
            
            if (groqData.error) {
                console.error("Groq Error:", groqData.error);
                return res.status(500).json({ error: groqData.error.message });
            }

            return res.status(200).json({ 
                content: [{ type: 'text', text: groqData.choices[0].message.content }],
                source: "Groq"
            });
        }

    } catch (finalError) {
        console.error("Server Error:", finalError);
        return res.status(500).json({ error: "सर्व सेवा सध्या व्यस्त आहेत. कृपया थोड्या वेळाने प्रयत्न करा." });
    }
}

