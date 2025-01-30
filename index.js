const { create } = require('@wppconnect-team/wppconnect');
const qrcode = require('qrcode-terminal');

const config = {
    sessionName: 'dynamicBot',
    maxGroups: 999,
    groupPrefix: 'Gimana enak di spam? Haha - ',
    delayBetweenInvites: 1000,
    authTimeout: 180,
    disableAutoClose: true,
    puppeteerOptions: {
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ]
    }
};

let clientInstance = null;

create({
    session: config.sessionName,
    authTimeout: config.authTimeout,
    disableAutoClose: config.disableAutoClose,
    puppeteerOptions: config.puppeteerOptions,
    catchQR: (qrCode) => {
        console.log('\n=== SCAN QR CODE DI WHATSAPP ANDA ===');
        qrcode.generate(qrCode, { small: true });
    },
    statusFind: (statusSession) => {
        console.log('Status Session:', statusSession);
    }
})
.then(async (client) => {
    clientInstance = client;
    console.log('Client created successfully');
    
    const isConnected = await client.isConnected();
    if (isConnected) {
        console.log('[STATUS] Bot siap!');
    }
    
    startDynamicBot(client);
})
.catch((error) => {
    console.error('Initialization Error:', error);
    process.exit(1);
});

async function startDynamicBot(client) {
    client.onMessage(async (msg) => {
        if (msg.body.startsWith('!spam')) {
            const args = msg.body.split(' ');
            const sender = msg.from;

            if (args.length < 3) {
                await client.sendText(sender, "Format salah! Gunakan: !spam [nomor_target] [jumlah_grup]");
                return;
            }

            const targetNumber = args[1];
            let groupCount = parseInt(args[2]);

            if (isNaN(groupCount) || groupCount < 1) {
                await client.sendText(sender, "Jumlah grup tidak valid!");
                return;
            }

            groupCount = Math.min(groupCount, config.maxGroups);
            const sanitizedNumber = targetNumber.replace(/[-+()\s]/g, '') + '@c.us';
            await client.sendText(sender, `🚀 Memulai spam ke ${targetNumber} untuk ${groupCount} grup...`);

            let success = 0;
            let failed = 0;

            for (let i = 1; i <= groupCount; i++) {
                try {
                    await createGroupWithDelay(client, sanitizedNumber, i);
                    success++;

                    if (i % 50 === 0) {
                        await client.sendText(sender, `📊 Progress: ${i}/${groupCount} (${((i/groupCount)*100).toFixed(1)}%)`);
                    }
                } catch (error) {
                    failed++;
                    console.error(`Grup ${i} gagal:`, error);
                }
                
                if (i < groupCount) {
                    await new Promise(resolve => setTimeout(resolve, config.delayBetweenInvites));
                }
            }

            await client.sendText(sender, `✅ Selesai!\nBerhasil: ${success}\nGagal: ${failed}\nSuccess Rate: ${((success/groupCount)*100).toFixed(1)}%`);
        }
    });
}

async function createGroupWithDelay(client, targetJid, index) {
    const groupName = `${config.groupPrefix}${index.toString().padStart(4, '0')}`;
    const group = await client.createGroup(groupName, [targetJid]);
    await new Promise(resolve => setTimeout(resolve, 500));
    await client.sendText(group.gid._serialized, `Grup spam ke-${index} dibuat`);
    return group;
}

process.on('SIGINT', async () => {
    if (clientInstance) {
        await clientInstance.close();
        console.log('Bot dimatikan');
    }
    process.exit();
});
