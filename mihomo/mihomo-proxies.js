const {
    type, 
    name, 
    home = false,
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


// ===== home ===== //
if (home === true || home === 'true') {
    // 1. 添加 provider


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
}


$content = ProxyUtils.yaml.safeDump(config)
