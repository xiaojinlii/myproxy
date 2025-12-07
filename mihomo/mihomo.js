const { 
  names,
  url,
  home = false,
} = $arguments

const config = ProxyUtils.yaml.safeLoad($files[0])

const namesArray = names ? names.split('|') : []

if (namesArray.length > 0) {
    namesArray.forEach(providerName => {
        // 使用 providerName 作为 key，例如 'name1', 'name2'
        // 使用 url 变量和当前的 providerName 拼接完整的订阅链接
        const providerUrl = `${url}/${providerName}`

        config['proxy-providers'][providerName] = {
            url: providerUrl,
            type: 'http',
            interval: 86400,
            'health-check': {
                enable: true,
                url: 'https://www.gstatic.com/generate_204',
                interval: 300
            },
            proxy: '直连' 
        }
    })
}

// ===== home ===== //
if (home === true || home === 'true') {
  const providerUrl = `${url}/Home`
  homeProvider = {
      url: providerUrl,
      type: 'http',
      interval: 86400,
      'health-check': {
        enable: true,
        url: 'https://connectivitycheck.platform.hicloud.com/generate_204',
        interval: 300
      },
      proxy: '直连'
  }
  config['proxy-providers'].push(homeProvider)
}


$content = ProxyUtils.yaml.safeDump(config)
