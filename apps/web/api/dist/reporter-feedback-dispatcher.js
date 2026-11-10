import { requireConfiguredReporterTransport } from './reporter-feedback-transport.js';
export async function dispatchReporterFeedback(transport, message) {
    const configured = requireConfiguredReporterTransport(transport);
    try {
        const result = await configured.send(message);
        return { status: result.status, ...(result.deliveredAt ? { deliveredAt: result.deliveredAt } : {}) };
    }
    catch (error) {
        const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
        return { status: 'failed', errorClass: code === 'CONFIGURATION' ? 'configuration' : 'temporary' };
    }
}
