/** Production adapters must be supplied by deployment configuration; no provider is hard-coded. */
export function requireConfiguredReporterTransport(transport) {
    if (!transport)
        throw new Error('reporter_feedback_transport_not_configured');
    return transport;
}
