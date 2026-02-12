import { Router, Request, Response } from 'express';
import { initBusinessAlexa, disconnectBusiness, isBusinessAlexaReady, getBusinessDevices } from '../services/alexa-multi';

const router = Router();

/**
 * POST /alexa/setup
 * 
 * Called from the LOKMA Admin Portal when a business owner
 * wants to connect their Amazon/Alexa account.
 * 
 * Body: { businessId, cookie }
 * 
 * The cookie is obtained via the alexa-remote2 proxy flow:
 * 1. Admin portal opens an iframe/popup to the gateway's proxy page
 * 2. User logs into their Amazon account
 * 3. Gateway captures the cookie and stores it
 */
router.post('/setup', async (req: Request, res: Response) => {
    const { businessId, cookie } = req.body;

    if (!businessId || !cookie) {
        res.status(400).json({ error: 'businessId and cookie are required' });
        return;
    }

    console.log(`🔧 Setting up Alexa for business: ${businessId}`);

    const success = await initBusinessAlexa(businessId, cookie);

    if (success) {
        const devices = getBusinessDevices(businessId);
        res.json({
            success: true,
            message: `Alexa bağlantısı başarılı! ${devices.length} cihaz bulundu.`,
            devices,
        });
    } else {
        res.status(500).json({
            success: false,
            message: 'Alexa bağlantısı başarısız. Cookie geçersiz olabilir.',
        });
    }
});

/**
 * GET /alexa/status/:businessId
 * Check if a business's Alexa is connected.
 */
router.get('/status/:businessId', (req: Request, res: Response) => {
    const bid = req.params.businessId as string;
    const ready = isBusinessAlexaReady(bid);
    const devices = ready ? getBusinessDevices(bid) : [];

    res.json({
        businessId: bid,
        connected: ready,
        devices,
    });
});

/**
 * DELETE /alexa/disconnect/:businessId
 * Remove a business's Alexa connection.
 */
router.delete('/disconnect/:businessId', (req: Request, res: Response) => {
    const bid = req.params.businessId as string;
    disconnectBusiness(bid);

    res.json({
        success: true,
        message: `Alexa bağlantısı kaldırıldı: ${bid}`,
    });
});

export default router;
