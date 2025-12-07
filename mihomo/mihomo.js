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

    // 2. 修改proxy-groups
    const newFilter = "^(?!(直连|home.*)).*$"
    config['proxy-groups'].forEach(group => {
        if (group.name === '♻️ 自动选择' || group.name === '🌐 全部节点') {
            group.filter = newFilter
        }
    })

    // 3. 添加home group
    const homeGroup = {
        name: '🐬 home', 
        type: 'select', 
        'include-all': true, 
        filter: 'home.*'
    }
    config['proxy-groups'].push(homeGroup)
}


$content = ProxyUtils.yaml.safeDump(config)
