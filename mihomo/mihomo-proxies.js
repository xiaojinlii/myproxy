const {
    type, 
    name, 
    home = false,
    tun = true,
} = $arguments


const config = ProxyUtils.yaml.safeLoad($files[0])

// ===== providers ===== //
if (config['proxy-providers']) {
    delete config['proxy-providers']
}


// ===== proxies ===== //
let clashMetaProxies = await produceArtifact({
  name,
  type: /^1$|col/i.test(type) ? 'collection' : 'subscription',
  platform: 'ClashMeta',
  produceType: 'internal',
})
config.proxies.unshift(...clashMetaProxies)


// ===== tun ===== // 
const enableTun = tun === true || tun === 'true'; 
config.tun = {
    ...(config.tun || {}), 
    enable: enableTun, 
};


// ===== home ===== //
if (home === true || home === 'true') {
    // 1. 添加 proxies
    // 通过聚合机场导入
    // let clashMetaProxies = await produceArtifact({
    //   name: 'Home',
    //   type: 'subscription',
    //   platform: 'ClashMeta',
    //   produceType: 'internal',
    // })
    // config.proxies.unshift(...clashMetaProxies)

    // 2. 修改 groups
    const newFilter = "^(?!(直连|home.*)).*$"
    config['proxy-groups'].forEach(group => {
        if (group.name === '♻️ 自动选择' || group.name === '🌐 全部节点') {
            group.filter = newFilter
        }
    })

    // 3. 添加 home group
    const homeGroup = {
        name: 'HOME', 
        type: 'select', 
        'include-all': true, 
        filter: 'home.*'
    }
    config['proxy-groups'].push(homeGroup)

    // 4. 添加 home rule
    const homeRule = 'IP-CIDR,172.16.1.0/24,HOME,no-resolve'
    config.rules.unshift(homeRule)

    // 5. 处理 xiaojinli.xyz 规则 (新增或修改)
    const targetKey = 'DOMAIN-SUFFIX,xiaojinli.xyz';
    const targetRule = `${targetKey},HOME`;
    let isRuleFound = false;

    // 遍历现有的 rules 寻找是否存在
    for (let i = 0; i < config.rules.length; i++) {
        // 只要规则包含在这个域名后缀（忽略原本指向哪里）
        if (config.rules[i].includes(targetKey)) {
            config.rules[i] = targetRule; // 直接替换为指向 HOME
            isRuleFound = true;
            break; // 找到一个就可以停止了，避免重复
        }
    }

    // 如果遍历完都没找到，则添加一条新的到最前面
    if (!isRuleFound) {
        config.rules.unshift(targetRule);
    }
}


$content = ProxyUtils.yaml.safeDump(config)
