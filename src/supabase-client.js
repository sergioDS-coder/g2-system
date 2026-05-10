// supabase-client.ts - Sync profilo player e classifica globale
export class SupabaseClient {
    constructor(url, anonKey) {
        Object.defineProperty(this, "url", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "key", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.url = url.replace(/\/$/, '');
        this.key = anonKey;
    }
    headers() {
        return {
            'apikey': this.key,
            'Authorization': `Bearer ${this.key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
        };
    }
    // ─── Sincronizza profilo player ──────────────────────────────────────────
    async upsertPlayer(player) {
        if (player.privacy === 'private')
            return true; // non sincronizza
        const row = {
            player_id: player.playerId,
            name: player.privacy === 'anonymous' ? `Player_${player.playerId.slice(0, 6)}` : player.name,
            level: player.level,
            rank: player.rank,
            exp_total: player.expTotal,
            exp_current: player.expCurrent,
            str_stat: player.attributes.str,
            agi_stat: player.attributes.agi,
            vit_stat: player.attributes.vit,
            int_stat: player.attributes.int,
            end_stat: player.attributes.end,
            quests_completed: player.questsCompleted,
            privacy: player.privacy,
            language: player.language,
        };
        try {
            const response = await fetch(`${this.url}/rest/v1/players?on_conflict=player_id`, {
                method: 'POST',
                headers: {
                    ...this.headers(),
                    'Prefer': 'resolution=merge-duplicates,return=minimal',
                },
                body: JSON.stringify(row),
            });
            return response.ok;
        }
        catch (err) {
            console.error('Errore upsert player:', err);
            return false;
        }
    }
    // ─── Recupera top 50 classifica ──────────────────────────────────────────
    async getRanking(limit = 50) {
        try {
            const response = await fetch(`${this.url}/rest/v1/players?select=*&privacy=in.(public,anonymous)&order=exp_total.desc&limit=${limit}`, { headers: this.headers() });
            if (!response.ok)
                return [];
            const rows = (await response.json());
            return rows.map(r => ({
                playerId: r.player_id,
                name: r.name,
                level: r.level,
                rank: r.rank,
                expTotal: r.exp_total,
                questsCompleted: r.quests_completed,
            }));
        }
        catch (err) {
            console.error('Errore fetch ranking:', err);
            return [];
        }
    }
    // ─── Posizione player in classifica ──────────────────────────────────────
    async getPlayerRank(playerId) {
        try {
            const ranking = await this.getRanking(500);
            const idx = ranking.findIndex(r => r.playerId === playerId);
            return idx >= 0 ? idx + 1 : null;
        }
        catch {
            return null;
        }
    }
}
