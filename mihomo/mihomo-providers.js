const { 
  names,
  url,
  home = false,
} = $arguments


const providerTemplate = {
    url: '机场订阅链接',
    type: 'http',
    interval: 86400,
    'health-check': {
        enable: true,
        url: 'https://www.gstatic.com/generate_204',
        interval: 300
    },
    proxy: '直连'
}


// ===== providers ===== //
const config = ProxyUtils.yaml.safeLoad($files[0])
config['proxy-providers'] = {}
const namesArray = names ? names.split('|') : []

// 遍历 names 列表，使用模板并修改 URL
if (namesArray.length > 0) {
    namesArray.forEach(providerName => {
        const newProvider = { ...providerTemplate } 
        newProvider.url = `${url}/${providerName}`
        config['proxy-providers'][providerName] = newProvider
    })
}


// ===== home ===== //
if (home === true || home === 'true') {
    // 1. 添加 provider
    const homeProviderName = 'Home'
    const homeProvider = { ...providerTemplate }
    homeProvider.url = `${url}/${homeProviderName}`
    homeProvider['health-check'] = { ...providerTemplate['health-check'] }
    homeProvider['health-check'].url = 'https://connectivitycheck.platform.hicloud.com/generate_204'
    config['proxy-providers'][homeProviderName] = homeProvider

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

    // 5. 处理 xiaojinli.fun 规则 (新增或修改)
    const targetKey = 'DOMAIN-SUFFIX,xiaojinli.fun';
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
