const mineflayer = require('mineflayer');
const Vec3 = require('vec3').Vec3
const { pathfinder, goals } = require("mineflayer-pathfinder");
const { GoalBlock } = goals
const data = require('minecraft-data')('1.12.2');

const findingCrops = ['potatoes', 'wheat', 'carrots'].map(crop => data.blocksByName[crop].id);
const seeds = ['potato', 'wheat_seeds', 'carrot'].map(seed => data.itemsByName[seed].id);
const point = new Vec3(-6, 4, 8);
const maxDistance = 32;
const count = 100;
const emptySlotCount = 9;
var storage = [new Vec3(-13, 4, 8)];
var errsCrops = [];

const bot = mineflayer.createBot({
    username: "bot",
    host: "localhost",
    version: '1.12.2'
});


function blockCrops(){
    var cropPositions = [];
    cropPositions.push(...errsCrops);
    errsCrops = [];
    for (var id of findingCrops){
        cropPositions.push(...bot.findBlocks({
            matching: id,
            point: point,
            maxDistance: maxDistance,
            count:count
        }));
    };

    for (var i = cropPositions.length - 1; i >= 0; i--){
        if (bot.blockAt(cropPositions[i]).metadata != 7){
            cropPositions.splice(i, 1);
        };
    };
    cropPositions.sort((a, b) => {
        const distanceA = bot.entity.position.distanceTo(new Vec3(bot.blockAt(a).position.x, 0, bot.blockAt(a).position.z));
        const distanceB = bot.entity.position.distanceTo(new Vec3(bot.blockAt(b).position.x, 0, bot.blockAt(b).position.z));
        return distanceA - distanceB;
    });
    return cropPositions;
};

async function digPlace(positions) {
    
    for (const position of positions) {

        await bot.pathfinder.goto(new GoalBlock(position.x, position.y, position.z));

        const cropAt = bot.blockAt(position);
        await bot.dig(cropAt,true);

        var i = 0;
        for (const crop of findingCrops) {
            if (crop == cropAt.type){
                if (bot.inventory.count(seeds[i]) == 0){
                    await bot.waitForTicks(30);
                }
                try {
                    await bot.equip(seeds[i], 'hand');
                    await bot.placeBlock(bot.blockAt(position.offset(0, -1, 0)), new Vec3(0, 1, 0));
                    break;
                } catch (error) {
                    errsCrops.push(position);
                };
            };
            i++;
        };
        //pick up the loot
        await bot.waitForTicks(6);
    };


};

async function storageLogic(){
    for (const pos of storage){
        await bot.pathfinder.goto(new GoalBlock(pos.x, pos.y, pos.z));
        const chests = bot.findBlocks({
            matching: data.blocksByName['chest'].id,
            point: pos,
            maxDistance: 4,
            count: 20
        });
        for (const chest of chests){

            var ches = await bot.openContainer(bot.blockAt(chest));
            try {
                for (const item of bot.inventory.items()){
                    await ches.deposit(item.type, null, item.count);
                }
            } catch (error) {
                ches.close();
                continue;
            }
            ches.close();
        };
    }
};
async function loop(){
    if (bot.inventory.emptySlotCount() <= emptySlotCount){
        bot.chat('Limited inventory space');
        await storageLogic();
    }
    var positions = blockCrops();
    await digPlace(positions);
    setTimeout(loop, 10000);
};


bot.once("spawn", () => {
    bot.chat(`Bot join : ${bot.username}`);
    bot.loadPlugin(pathfinder);
    loop();
});

bot.on("chat",(username, message) => {
    if (username === bot.username) return;
    switch (message) {
        case 'crops':
            blockCrops();
            break;

        case 'loop':
            loop();
            break;


        case '!exit':
            bot.quit();

            break;

        case 'storage':
            storagePos = bot.players[username].entity.position.floored();
            for (const pos of storage){
                if (pos.equals(storagePos)){
                    return;
                };
            };
            storage.push(storagePos);
            console.log(storage);
            break;
    
        default:
            break;
    };
});