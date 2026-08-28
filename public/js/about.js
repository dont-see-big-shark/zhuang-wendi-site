$(function() {
  // multilingual 初始化在 BaseLayout 里统一处理（避免重复）

  // 子菜单交互
  $('.submenu-btn').on('click', function() {
    var target = $(this).data('target');
    // 处理按钮 active 状态
    $('.submenu-btn').removeClass('active');
    $(this).addClass('active');
    // 显示/隐藏区块
    $('.submenu-content').hide();
    $('#' + target).show();
  });

  // 进入页面时强制先显示简介区块
  $('.submenu-btn[data-target="about-section"]').addClass('active');
  $('.submenu-btn[data-target="contact-section"]').removeClass('active');
  $('#about-section').show();
  $('#contact-section').hide();
});

document.addEventListener('DOMContentLoaded', () => {
    // 子菜单项
    const submenuLinks = document.querySelectorAll('.submenu a');
    
    // 区块元素
    const sections = document.querySelectorAll('.content-section');
    
    // 滚动事件监听
    window.addEventListener('scroll', () => {
        let current = '';
        
        // 找到当前滚动位置对应的区块
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            const sectionHeight = section.offsetHeight;
            
            if (window.pageYOffset >= sectionTop && window.pageYOffset < sectionTop + sectionHeight) {
                current = section.getAttribute('id');
            }
        });
        
        // 激活对应区块的子菜单项
        submenuLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
    
    // 点击子菜单时的滚动动画
    submenuLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            
            window.scrollTo({
                top: targetSection.offsetTop - 80,
                behavior: 'smooth'
            });
            
            // 更新 active 类
            submenuLinks.forEach(item => item.classList.remove('active'));
            this.classList.add('active');
        });
    });
}); 
