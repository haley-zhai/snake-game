const GITHUB_CONFIG = {
    // GitHub 用户名
    OWNER: 'haley-zhai',
    
    // 仓库名
    REPO: 'snake-game',
    
    // GitHub Personal Access Token
    // 获取方式：GitHub → Settings → Developer settings → Personal access tokens
    // 需要勾选 'repo' 权限
    // ⚠️ 警告：不要把真实的 Token 提交到 GitHub！
    TOKEN: 'ghp_YOUR_TOKEN_HERE',
    
    // Issue 标签（用于筛选排行榜数据）
    LABEL: 'leaderboard'
};

// 验证配置是否已修改
function checkConfig() {
    if (GITHUB_CONFIG.TOKEN === 'ghp_YOUR_TOKEN_HERE' || GITHUB_CONFIG.TOKEN === '') {
        console.warn('⚠️ 请先配置 GitHub Token！');
        return false;
    }
    return true;
}
