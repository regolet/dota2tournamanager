import fetch from 'node-fetch';

// Player data in format: name, dota2id, mmr
const playersData = [
    ['pepper', '1093845076', 12800],
    ['Ricson', '1835505661', 12700],
    ['paul', '372399806', 12000],
    ['Paul', '1016591093', 12000],
    ['scarletreign09', '494553157', 11700],
    ['nyaw', '142075333', 11500],
    ['Spookky', '192688867', 11500],
    ['bart', '143683844', 11000],
    ['bart', '309274165', 11000],
    ['Bimbo', '135495981', 11000],
    ['Kenji', '1100979717', 11000],
    ['Kimchi', '1895261208', 11000],
    ['Poiuuyt', '377269789', 11000],
    ['niko3234', '411970426', 10700],
    ['Bleys', '1024265121', 10500],
    ['hakdok_.', '252731708', 10500],
    ['amek', '481318645', 10450],
    ['sae', '375358249', 10450],
    ['blue', '442164131', 10350],
    ['Ymirrr', '922410454', 10200],
    ['Chichang.', '219664019', 10021],
    ['Aimvillain__', '291162478', 10000],
    ['ays', '998248288', 10000],
    ['bon', '374314968', 10000],
    ['bon', '866765857', 10000],
    ['IBARRA', '34533028', 10000],
    ['IBARRA', '39419234', 10000],
    ['ibarra', '345336028', 10000],
    ['jt', '873959895', 10000],
    ['jt', '999650131', 10000],
    ['MASD', '153513975', 10000],
    ['n1ts', '399121895', 10000],
    ['ninn', '299574832', 10000],
    ['Popo', '1224263910', 10000],
    ['Ry', '127358738', 10000],
    ['spike', '326872750', 10000],
    ['jaa', '123457899', 9800],
    ['JAA', '130527080', 9800],
    ['jaa', '154124125', 9800],
    ['jaa', '183746322', 9800],
    ['ron', '1073069979', 9800],
    ['Nastzzz', '179163180', 9700],
    ['keneiasss_', '338779089', 9500],
    ['McLaren', '179437504', 9500],
    ['miki', '208749330', 9500],
    ['XA', '120760534', 9500],
    ['Deys', '241469061', 9200],
    ['Megs', '149894470', 9200],
    ['Ji', '190871580', 9100],
    ['Bigboy', '224600007', 9000],
    ['Datzteezy', '185911911', 9000],
    ['Datzteezy', '1145489200', 9000],
    ['dongito', '386040406', 9000],
    ['Jer', '100563562', 9000],
    ['Jer', '133383548', 9000],
    ['Jer', '170358047', 9000],
    ['Jer', '204044959', 9000],
    ['jz/kuna', '137081722', 9000],
    ['Kekw', '439143865', 9000],
    ['Kirezo', '165014940', 9000],
    ['Papa P', '297888101', 9000],
    ['Rex', '110997594', 9000],
    ['Ryu', '1020083002', 8900],
    ['Blanc', '837536670', 8800],
    ['kotoko_o.o (blank)', '837536670', 8800],
    ['313ambi.', '199700193', 8600],
    ['buluba', '335782244', 8500],
    ['dazai', '373882295', 8500],
    ['mok', '145405550', 8500],
    ['Chi', '145292382', 8499],
    ['allen', '342100582', 8400],
    ['DAZAI', '249281741', 8300],
    ['Prodijay', '86788560', 8300],
    ['hums', '392312555', 8200],
    ['Shinchan', '19820093', 8200],
    ['Maddox', '113992987', 8100],
    ['Medel', '1713259918', 8100],
    ['kyle', '234679914', 8049],
    ['kyle', '242378642', 8049],
    ['-tribz-', '855364755', 8000],
    ['clean', '865093115', 8000],
    ['Feitan`', '229284342', 8000],
    ['Feitan`', '1203908575', 8000],
    ['Gabby', '196810231', 8000],
    ['Gabby', '842064970', 8000],
    ['ianp', '164029976', 8000],
    ['jethlo', '378417538', 8000],
    ['kasuuuzxc', '192707167', 8000],
    ['kasuuuzxc', '1003071064', 8000],
    ['Lao', '493538913', 8000],
    ['Okiks`', '199700193', 8000],
    ['Rxx', '345780550', 8000],
    ['Salisii', '155849727', 8000],
    ['Yowdap', '111479950', 8000],
    ['g..', '242058724', 7800],
    ['Goku', '152645986', 7800],
    ['goku', '156879478', 7800],
    ['DAR', '35562933', 7700],
    ['dar', '355263772', 7700],
    ['love sosa', '197434188', 7700],
    ['Petoromu', '370645454', 7700],
    ['rudi', '1170379842', 7700],
    ['Yats', '342957206', 7700],
    ['browniesalphaandgoodplaycall', '1030490141', 7500],
    ['Bryle', '185749312', 7500],
    ['HATHAWAY', '192065509', 7500],
    ['Kriz', '344986848', 7500],
    ['toyskie', '340590098', 7500],
    ['^^', '344311761', 7300],
    ['Silencio', '150083512', 7263],
    ['Capiche', '861699715', 7225],
    ['Cuds / ^^', '196390781', 7200],
    ['Kelslsls', '913773965', 7200],
    ['Kelslslsl', '913773965', 7200],
    ['HyO', '182065786', 7100],
    ['JAL', '103342275', 7025],
    ['aql', '327986914', 7000],
    ['Arya', '196102714', 7000],
    ['Charlie', '366361335', 7000],
    ['eris', '258055831', 7000],
    ['guko', '182268573', 7000],
    ['Halimaw mag pa squirt', '129176770', 7000],
    ['iu143', '205727702', 7000],
    ['krrys', '119629840', 7000],
    ['Mac', '355664943', 7000],
    ['Paksss', '367214120', 7000],
    ['qw3g', '191396401', 7000],
    ['Shin su hyun', '252766891', 7000],
    ['Ady/CalDevens.', '162928786', 6990],
    ['Adam`', '838486369', 6700],
    ['9Ass', '875493247', 6500],
    ['andy', '347269599', 6500],
    ['cannabeast', '1246818826', 6500],
    ['G..', '1246818826', 6500],
    ['Giocute', '206139579', 6500],
    ['Hakob', '78716215', 6500],
    ['hakob', '162044560', 6500],
    ['Karr - pandapanda 9677', '354876132', 6500],
    ['Keng', '92463299', 6500],
    ['Pao', '379693212', 6500],
    ['rb', '131900546', 6500],
    ['Sav', '188950022', 6500],
    ['breezyowa', '309258572', 6400],
    ['CASUALOFFLANE', '173780393', 6400],
    ['jake zyrus', '206033147', 6332],
    ['Ciara', '412587289', 6300],
    ['SQ', '180348355', 6300],
    ['tep', '199224957', 6300],
    ['teptep', '199224957', 6300],
    ['Aday', '168995116', 6200],
    ['Kise-', '399512532', 6200],
    ['Malone', '847286155', 6200],
    ['davepuso', '415172576', 6000],
    ['demi', '354423663', 6000],
    ['EasyCat', '129310171', 6000],
    ['HanaeL', '340850481', 6000],
    ['Jacob', '836911086', 6000],
    ['JennaRRT', '189866215', 6000],
    ['jz bg', '334855270', 6000],
    ['karding', '297627210', 6000],
    ['Korri', '1715236600', 6000],
    ['Mags', '362717926', 6000],
    ['Mags', '387409300', 6000],
    ['Malone', '76561198807551883', 6000],
    ['Mira', '424610262', 6000],
    ['salam', '345473234', 6000],
    ['Sawj', '353785879', 6000],
    ['SOLACE', '125918666', 6000],
    ['Solace', '402980461', 6000],
    ['Tyler', '1288127210', 6000],
    ['Vodz', '902238358', 6000],
    ['yone', '224247875', 6000],
    ['Itsjim', '203884367', 5900],
    ['BossD/Derflamingo', '144077372', 5800],
    ['eddgotyou', '1039371900', 5800],
    ['Maryo', '420861070', 5800],
    ['Qwertypups', '123342403', 5800],
    ['Tusef', '376482578', 5740],
    ['Hitman412', '93960960', 5702],
    ['micko', '371359830', 5700],
    ['Diemon', '321935319', 5600],
    ['mjdc - jeremy', '857001040', 5600],
    ['Rain', '196142761', 5600],
    ['Kerzzz', '359307158', 5500],
    ['Budaga', '115511312', 5420],
    ['Budaga', '76561198075777040', 5420],
    ['Burat ni spongebob', '911685048', 5400],
    ['Chromax', '199338244', 5400],
    ['Flux', '1135814775', 5400],
    ['OdinidO', '374861254', 5400],
    ['piglord', '14800782', 5400],
    ['trooperKeith', '172906042', 5300],
    ['Toinks', '363898297', 5212],
    ['eron', '169052338', 5200],
    ['eron', '169872621', 5200],
    ['Nanika', '487314684', 5200],
    ['Baby shark', '1510970866', 5100],
    ['Beautiful Distress/Meowy', '131732616', 5000],
    ['Ecka', '316765841', 5000],
    ['Emel', '152838063', 5000],
    ['Jenggy', '444303057', 5000],
    ['Kazue', '324793873', 5000],
    ['krayzie', '205007077', 5000],
    ['lay', '130566091', 5000],
    ['Les Lie', '413115378', 5000],
    ['Toyama', '224609537', 5000],
    ['Majir', '195755361', 4900],
    ['zxc', '182927263', 4900],
    ['JohnyBravo', '453053239', 4800],
    ['Spencer', '76561199408860133', 4780],
    ['Fingolfin', '346761605', 4700],
    ['Fingolfin', '347970346', 4700],
    ['myaw', '306731016', 4700],
    ['Cuss', '193936358', 4633],
    ['Yui', '895692534', 4600],
    ['beks', '401747267', 4560],
    ['cocomelon', '452115492', 4500],
    ['Jho', '206306528', 4500],
    ['Shinobu', '90682208', 4500],
    ['Shinobu', '138383832', 4500],
    ['w1Sh', '195650967', 4500],
    ['xaxaxa', '102991985', 4500],
    ['Yabmub', '454532408', 4500],
    ['Yoo-', '1217279153', 4500],
    ['Hello?', '392494106', 4400],
    ['Jamesy', '158022661', 4300],
    ['pamey', '392111568', 4100],
    ['ange', '1236573721', 4000],
    ['Gabby (Jax)', '204228861', 4000],
    ['green', '15101353', 4000],
    ['imuy', '188239650', 4000],
    ['Jiji', '882831166', 4000],
    ['michi', '956775413', 4000],
    ['pamey', '196575145', 4000],
    ['PUKESA', '146373601', 4000],
    ['TheAsianCaster', '443522039', 4000],
    ['riri', '339244278', 3800],
    ['HOTDOGNIALJUR', '267526328', 3500],
    ['Pol', '246882097', 3300],
    ['dondi9197', '177377746', 3000],
    ['Gold1e', '138214069', 3000],
    ['Jiji', '882831166', 3000],
    ['penpen', '1309486419', 3000],
    ['Salsicha', '442749255', 3000],
    ['V..', '123394690', 3000],
    ['yohan', '363108013', 3000],
    ['X.B', '477349401', 2800],
    ['bossregz', '176166671', 1500]
];

async function addPlayerToMasterlist(name, dota2id, mmr) {
    try {
        const response = await fetch('https://dota2regz.netlify.app/.netlify/functions/add-player', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-bulk-import': 'true'
            },
            body: JSON.stringify({
                name: name,
                dota2id: dota2id,
                peakmmr: mmr
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log(`✅ Added: ${name} (${dota2id}) - MMR: ${mmr}`);
            return { success: true, message: 'Added successfully' };
        } else {
            if (data.message && data.message.includes('already')) {
                console.log(`⏭️  Skipped: ${name} (${dota2id}) - Already exists`);
                return { success: true, message: 'Already exists' };
            } else {
                console.log(`❌ Failed: ${name} (${dota2id}) - ${data.message || 'Unknown error'}`);
                return { success: false, message: data.message || 'Unknown error' };
            }
        }
    } catch (error) {
        console.log(`❌ Error adding ${name} (${dota2id}): ${error.message}`);
        return { success: false, message: error.message };
    }
}

async function bulkAddPlayers() {
    console.log('🚀 Starting bulk player import...');
    console.log(`📊 Total players to process: ${playersData.length}`);
    console.log('');

    let added = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < playersData.length; i++) {
        const [name, dota2id, mmr] = playersData[i];
        
        console.log(`Processing ${i + 1}/${playersData.length}: ${name}`);
        
        const result = await addPlayerToMasterlist(name, dota2id, mmr);
        
        if (result.success) {
            if (result.message === 'Already exists') {
                skipped++;
            } else {
                added++;
            }
        } else {
            failed++;
        }

        // Add a small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('');
    console.log('📈 Import Summary:');
    console.log(`✅ Added: ${added} players`);
    console.log(`⏭️  Skipped: ${skipped} players (already exist)`);
    console.log(`❌ Failed: ${failed} players`);
    console.log(`📊 Total processed: ${playersData.length} players`);
}

// Run the bulk import
bulkAddPlayers().catch(console.error); 