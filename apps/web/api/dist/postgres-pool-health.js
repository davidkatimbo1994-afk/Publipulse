/**
 * Checks connectivity and always releases the checked-out client.
 * If both the query and release fail, preserve the query error because it is
 * the primary failure that explains why readiness could not be established.
 */
export async function checkPostgresClient(client) {
    let operationFailed = false;
    try {
        await client.query('SELECT 1');
        return true;
    }
    catch (error) {
        operationFailed = true;
        throw error;
    }
    finally {
        try {
            client.release();
        }
        catch (releaseError) {
            if (!operationFailed)
                throw releaseError;
        }
    }
}
