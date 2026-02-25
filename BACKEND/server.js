const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { generateAlloyFile } = require('./src/alloyGenerator');
const { executeAlloy, cleanupTempFiles } = require('./src/alloyExecutor');
const { validateCommonProperties } = require('./src/simpleValidator');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// CORS: restrict to known origins in production
const corsOptions = IS_PRODUCTION
    ? { origin: process.env.CORS_ORIGIN || 'http://localhost:5173', methods: ['POST', 'GET'] }
    : { origin: true };
app.use(cors(corsOptions));

app.use(bodyParser.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// Input Validation
// ============================================================
function validateAnalysisInput(data) {
    if (!data || typeof data !== 'object') {
        return 'Request body must be a JSON object';
    }

    // Must have at least locations or systems
    if ((!data.locations || !Array.isArray(data.locations)) &&
        (!data.systems || !Array.isArray(data.systems))) {
        return 'Request must contain "locations" or "systems" arrays';
    }

    // Validate locations if present
    if (data.locations && Array.isArray(data.locations)) {
        for (const loc of data.locations) {
            if (!loc.id) return 'Each location must have an "id"';
        }
    }

    // Validate systems if present
    if (data.systems && Array.isArray(data.systems)) {
        for (const sys of data.systems) {
            if (!sys.id) return 'Each system must have an "id"';
            if (!sys.loc && !sys.location) return `System "${sys.id}" must have a location ("loc" or "location")`;
        }
    }

    // Validate connections if present
    if (data.connections && Array.isArray(data.connections)) {
        for (const conn of data.connections) {
            if (!conn.from || !conn.to) return 'Each connection must have "from" and "to"';
        }
    }

    // Validate data if present
    if (data.data && !Array.isArray(data.data)) {
        return '"data" must be an array';
    }

    return null; // Valid
}

// ============================================================
// Analysis Endpoint
// ============================================================
app.post('/analyze', async (req, res) => {
    let alloyFilePath = null;

    try {
        const diagramData = req.body;

        // Input validation
        const validationError = validateAnalysisInput(diagramData);
        if (validationError) {
            return res.status(400).json({ success: false, error: validationError });
        }

        if (!IS_PRODUCTION) {
            console.log('Received analysis request');
            try {
                fs.writeFileSync('last_request_payload.json', JSON.stringify(diagramData, null, 2));
            } catch (e) { /* ignore */ }
        }

        // 1. JS Validator (Fast Check)
        const jsValidation = validateCommonProperties(diagramData);
        if (!IS_PRODUCTION) {
            console.log(`JS Validation found ${jsValidation.total_count} violations.`);
        }

        // 2. Alloy Engine (Deep Check)
        alloyFilePath = await generateAlloyFile(diagramData);
        const executionResult = await executeAlloy(alloyFilePath);

        // 3. Merge Results (Hybrid Verification)
        if (executionResult.success) {
            const finalThreats = { ...executionResult.result.threats };
            let finalCount = executionResult.result.total_count;

            // Merge JS threats into Alloy threats (with deduplication)
            Object.keys(jsValidation.threats).forEach(key => {
                if (jsValidation.threats[key] && jsValidation.threats[key].length > 0) {
                    if (!finalThreats[key]) finalThreats[key] = [];
                    // Only add JS threats not already found by Alloy
                    const existingIds = new Set(
                        finalThreats[key].map(t => (t.system || t.connection || ''))
                    );
                    const newThreats = jsValidation.threats[key].filter(t => {
                        const id = t.system || t.connection || '';
                        return !existingIds.has(id);
                    });
                    finalThreats[key] = [...finalThreats[key], ...newThreats];
                    finalCount += newThreats.length;
                }
            });

            const finalResult = {
                threats: finalThreats,
                total_count: finalCount
            };

            if (!IS_PRODUCTION) {
                try {
                    fs.writeFileSync('debug_response_hybrid.json', JSON.stringify(finalResult, null, 2));
                } catch (e) { /* ignore */ }
            }

            res.json({ success: true, result: finalResult });
        } else {
            res.status(500).json({ success: false, error: executionResult.error });
        }
    } catch (error) {
        console.error('Error during analysis:', error.message);
        if (!IS_PRODUCTION) {
            try {
                fs.writeFileSync('last_error.txt', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
            } catch (e) { /* ignore */ }
        }
        res.status(500).json({ success: false, error: error.message });
    } finally {
        // Clean up temporary Alloy files
        if (alloyFilePath) {
            cleanupTempFiles(alloyFilePath);
        }
    }
});

const server = app.listen(PORT, () => {
    console.log(`AMADEUS Backend running on http://localhost:${PORT} [${IS_PRODUCTION ? 'production' : 'development'}]`);
});

server.on('error', (error) => {
    console.error('Server failed to start:', error);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});
