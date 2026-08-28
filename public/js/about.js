$(function() {
  // multilingual 초기화는 BaseLayout에서 공통 처리 (중복 방지)

  // 서브 메뉴 동작
  $('.submenu-btn').on('click', function() {
    var target = $(this).data('target');
    // 버튼 active 처리
    $('.submenu-btn').removeClass('active');
    $(this).addClass('active');
    // 섹션 표시/숨김
    $('.submenu-content').hide();
    $('#' + target).show();
  });

  // 페이지 진입 시 About가 먼저 보이도록 강제
  $('.submenu-btn[data-target="about-section"]').addClass('active');
  $('.submenu-btn[data-target="contact-section"]').removeClass('active');
  $('#about-section').show();
  $('#contact-section').hide();
});

document.addEventListener('DOMContentLoaded', () => {
    // 서브메뉴 항목
    const submenuLinks = document.querySelectorAll('.submenu a');
    
    // 섹션 요소
    const sections = document.querySelectorAll('.content-section');
    
    // 스크롤 이벤트 리스너
    window.addEventListener('scroll', () => {
        let current = '';
        
        // 현재 스크롤 위치에 해당하는 섹션 찾기
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            const sectionHeight = section.offsetHeight;
            
            if (window.pageYOffset >= sectionTop && window.pageYOffset < sectionTop + sectionHeight) {
                current = section.getAttribute('id');
            }
        });
        
        // 해당 섹션에 맞는 서브메뉴 항목 활성화
        submenuLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
    
    // 서브메뉴 클릭 시 스크롤 애니메이션
    submenuLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            
            window.scrollTo({
                top: targetSection.offsetTop - 80,
                behavior: 'smooth'
            });
            
            // 활성 클래스 업데이트
            submenuLinks.forEach(item => item.classList.remove('active'));
            this.classList.add('active');
        });
    });
}); 