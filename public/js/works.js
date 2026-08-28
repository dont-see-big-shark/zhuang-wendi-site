$(function() {
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

    // 进入页面时强制先显示 PHOTOS 区块
    $('.submenu-btn[data-target="photos-section"]').addClass('active');
    $('.submenu-btn[data-target="books-section"]').removeClass('active');
    $('#photos-section').show();
    $('#books-section').hide();
});

document.addEventListener('DOMContentLoaded', () => {
    // 各项目的图片目录映射
    const projectFolders = {
        'backward-drift': 'backward-drift',
        'glass-eye': 'glass-eye',
        'the-faceless': 'the-faceless',
        'shade-of-blue': 'shade-of-blue',
        'imperfect-jeonju': 'imperfect-jeonju',
        'glass-eye-book': 'glass-eye',
        'shade-of-blue-book': 'shade-of-blue'
    };

    // 图片格式映射
    const imageFormat = {
        'backward-drift': 'webp',
        'glass-eye': 'webp',
        'the-faceless': 'webp',
        'shade-of-blue': 'webp',
        'imperfect-jeonju': 'webp',
        'glass-eye-book': 'webp',
        'shade-of-blue-book': 'webp'
    };

    // 图片基础路径映射
    const imagePath = {
        'backward-drift': '/src/images/photos/',
        'glass-eye': '/src/images/photos/',
        'the-faceless': '/src/images/photos/',
        'shade-of-blue': '/src/images/photos/',
        'imperfect-jeonju': '/src/images/photos/',
        'glass-eye-book': '/src/images/books/',
        'shade-of-blue-book': '/src/images/books/'
    };

    // 存放每个项目图片列表的对象
    const projectImages = {};
    
    // 跟踪每个项目的当前索引和已加载图片数
    const projectState = {};
    
    // 加载状态跟踪
    const loadingState = {
        totalProjects: Object.keys(projectFolders).length,
        loadedProjects: 0,
        isInitialized: false
    };

    // 并行加载所有项目的图片
    initializeAllProjects();

    // 初始化所有项目
    async function initializeAllProjects() {
        console.log('🚀 开始加载所有项目图片...');
        
        // 并行生成所有项目的图片列表
        const projectPromises = Object.keys(projectFolders).map(project => {
            return generateImageList(project);
        });

        // 等待所有图片列表生成完毕
        await Promise.all(projectPromises);
        
        // 并行加载所有项目的图片
        const loadingPromises = Object.keys(projectFolders).map(project => {
            return loadImagesForProject(project);
        });

        // 等待所有项目加载完成
        await Promise.all(loadingPromises);
        
        console.log('✅ 所有项目图片加载完成!');
        loadingState.isInitialized = true;
    }

    // 生成各项目图片列表
    function generateImageList(projectId) {
        return new Promise((resolve) => {
            // 图片列表由 Astro 构建时优化（webp）后注入 window。
            // （基于 CMS 集合，保持 frontmatter 顺序 —— 不打乱）
            const injected = (typeof window !== 'undefined' && window.__WORKS_IMAGES__) || {};
            projectImages[projectId] = injected[projectId] || [];

            // 初始化项目状态
            projectState[projectId] = {
                currentIndex: 0,
                loadedImages: 0,
                loadedPaths: [],
                isLoaded: false
            };

            resolve();
        });
    }

    // 按项目加载图片（改进版）
    async function loadImagesForProject(projectId) {
        return new Promise((resolve) => {
            const galleryCol = document.querySelector(`.project-gallery-col[data-project="${projectId}"]`);
            if (!galleryCol) {
                resolve();
                return;
            }
            
            const sliderContainer = galleryCol.querySelector('.slider-container');

            if (!sliderContainer) {
                resolve();
                return;
            }

            const imagePaths = projectImages[projectId];
            if (!imagePaths || imagePaths.length === 0) {
                resolve();
                return;
            }

            // BOOKS 区块预加载全部图片，PHOTOS 只先加载 5 张
            const initialLoadCount = projectId.includes('book') ? imagePaths.length : 5;
            
            // 图片预加载（BOOKS 区块用）
            if (projectId.includes('book')) {
                preloadImages(projectId, imagePaths).then(() => {
                    // 全部图片加载完成后再加入轮播
                    addImagesToSlider(projectId, imagePaths);
                    setupSliderControls(projectId);
                    projectState[projectId].isLoaded = true;
                    loadingState.loadedProjects++;
                    console.log(`📚 ${projectId} 加载完成 (${imagePaths.length} 张图片)`);
                    resolve();
                });
            } else {
                // PHOTOS 区块只加载初始图片
                addImagesToSlider(projectId, imagePaths.slice(0, initialLoadCount));
                setupSliderControls(projectId);
                projectState[projectId].isLoaded = true;
                loadingState.loadedProjects++;
                console.log(`📸 ${projectId} 初始加载完成 (${initialLoadCount} 张图片)`);
                resolve();
            }
        });
    }

    // 图片预加载（BOOKS 区块用）
    function preloadImages(projectId, imagePaths) {
        return new Promise((resolve) => {
            let loadedCount = 0;
            const totalImages = imagePaths.length;

            imagePaths.forEach((path, index) => {
                const img = new Image();
                img.onload = () => {
                    projectState[projectId].loadedPaths.push(path);
                    loadedCount++;
                    
                    if (loadedCount === totalImages) {
                        resolve();
                    }
                };
                img.onerror = () => {
                    console.warn(`⚠️ 图片加载失败: ${path}`);
                    loadedCount++;
                    
                    if (loadedCount === totalImages) {
                        resolve();
                    }
                };
                img.src = path;
            });
        });
    }

    // 向轮播添加图片
    function addImagesToSlider(projectId, imagePaths) {
        const galleryCol = document.querySelector(`.project-gallery-col[data-project="${projectId}"]`);
        if (!galleryCol) return;
        
        const sliderContainer = galleryCol.querySelector('.slider-container');
        if (!sliderContainer) return;

        // 移除已有图片
        sliderContainer.innerHTML = '';

        imagePaths.forEach((path, index) => {
            const img = document.createElement('img');
            img.src = path;
            img.alt = `${projectId} image ${index + 1}`;
            img.dataset.index = index;
            
            // 只显示第一张
            if (index === 0) {
                img.classList.add('is-current');
            }
            
            sliderContainer.appendChild(img);
        });

        projectState[projectId].loadedImages = imagePaths.length;
        updateSlider(projectId);
    }

    // 轮播操作: 点击黑色区域（含图片四周留白）的左右半边翻页。
    // 序号徽标按屏幕类型摆放:
    //  - 鼠标 + 宽屏: 徽标跟随光标移动。
    //  - 窄屏或触屏: 固定在右上角，翻页时短暂显示。
    //    （有的浏览器窗口窄了仍报告 pointer:fine，所以同时参考屏幕宽度）
    function setupSliderControls(projectId) {
        const galleryCol = document.querySelector(`.project-gallery-col[data-project="${projectId}"]`);
        if (!galleryCol) return;

        const slider = galleryCol.querySelector('.gallery-slider');
        const counter = galleryCol.querySelector('.slider-counter');
        if (!slider) return;
        const area = galleryCol; // 操作与悬停区域 = 整个黑色区域

        const isCornerMode = () =>
            window.innerWidth <= 768 ||
            !window.matchMedia('(hover: hover) and (pointer: fine)').matches;

        let suppressClick = false; // 忽略滑动后紧跟着触发的 click
        let hideTimer;

        function setNumber() {
            if (counter) counter.textContent = String(projectState[projectId].currentIndex + 1);
        }

        // 清除跟随光标的痕迹，恢复到右上角（CSS 默认位置）
        function toCorner() {
            if (!counter) return;
            counter.classList.remove('as-cursor', 'point-left', 'point-right');
            counter.classList.add('point-none');
            counter.style.left = '';
            counter.style.top = '';
            counter.style.right = '';
        }

        function refreshCounter() {
            setNumber();
            if (!counter || !isCornerMode()) return;
            toCorner();
            counter.classList.add('show');
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => counter.classList.remove('show'), 1400);
        }

        function go(delta) {
            const st = projectState[projectId];
            if (delta > 0) {
                if (st.currentIndex >= st.loadedImages - 1 && !projectId.includes('book')) {
                    loadMoreImages(projectId, 3);
                }
                if (st.currentIndex < st.loadedImages - 1) {
                    st.currentIndex++;
                    updateSlider(projectId);
                    refreshCounter();
                    if (!projectId.includes('book') && st.currentIndex >= st.loadedImages - 2) {
                        loadMoreImages(projectId, 3);
                    }
                }
            } else if (st.currentIndex > 0) {
                st.currentIndex--;
                updateSlider(projectId);
                refreshCounter();
            }
        }

        // 右半边 = 下一张，左半边 = 上一张
        area.addEventListener('click', (e) => {
            if (suppressClick) { suppressClick = false; return; }
            const rect = area.getBoundingClientRect();
            go(e.clientX - rect.left > rect.width / 2 ? 1 : -1);
        });

        if (counter) {
            const moveTo = (e) => {
                if (isCornerMode()) return;
                const rect = area.getBoundingClientRect();
                counter.classList.add('as-cursor');
                // 根据光标所在半边，箭头端点指向对应方向
                const toRight = e.clientX - rect.left > rect.width / 2;
                counter.classList.toggle('point-right', toRight);
                counter.classList.toggle('point-left', !toRight);
                counter.classList.remove('point-none');
                counter.style.right = 'auto';
                counter.style.left = e.clientX - rect.left + 'px';
                counter.style.top = e.clientY - rect.top + 'px';
            };

            area.addEventListener('mouseenter', (e) => {
                if (isCornerMode()) return;
                area.classList.add('cursor-badge');
                moveTo(e);
                counter.classList.add('show');
            });
            area.addEventListener('mousemove', moveTo);
            area.addEventListener('mouseleave', () => {
                area.classList.remove('cursor-badge');
                if (!isCornerMode()) counter.classList.remove('show');
            });

            // 屏幕尺寸变化导致模式切换时清理痕迹
            window.addEventListener('resize', () => {
                if (isCornerMode()) {
                    area.classList.remove('cursor-badge');
                    toCorner();
                    counter.classList.remove('show');
                }
            });

            if (isCornerMode()) refreshCounter(); // 首次短暂显示一次，提示操作方式
        }

        // 保留滑动手势
        let startX = 0;
        let currentX = 0;
        let dragging = false;

        area.addEventListener('touchstart', (e) => {
            startX = currentX = e.touches[0].clientX;
            dragging = true;
        }, { passive: true });

        area.addEventListener('touchmove', (e) => {
            if (dragging) currentX = e.touches[0].clientX;
        }, { passive: true });

        area.addEventListener('touchend', () => {
            if (!dragging) return;
            dragging = false;
            const diff = startX - currentX;
            if (Math.abs(diff) > 50) {
                suppressClick = true;
                go(diff > 0 ? 1 : -1);
            }
        });

        setNumber();
    }

    // 追加图片加载（PHOTOS 区块用）
    function loadMoreImages(projectId, count) {
        const galleryCol = document.querySelector(`.project-gallery-col[data-project="${projectId}"]`);
        if (!galleryCol) return;
        
        const sliderContainer = galleryCol.querySelector('.slider-container');
        if (!sliderContainer) return;
        
        const currentLoadedCount = sliderContainer.children.length;
        const projectImageList = projectImages[projectId];
        
        // 全部图片已加载完成时
        if (currentLoadedCount >= projectImageList.length) return;
        
        // 计算还要加载的图片数量
        const remainingImages = projectImageList.length - currentLoadedCount;
        const imagesToLoad = Math.min(count, remainingImages);
        
        for (let i = 0; i < imagesToLoad; i++) {
            const index = currentLoadedCount + i;
            const img = document.createElement('img');
            img.src = projectImageList[index];
            img.alt = `${projectId} image ${index + 1}`;
            img.dataset.index = index;
            
            sliderContainer.appendChild(img);
        }
        
        projectState[projectId].loadedImages = currentLoadedCount + imagesToLoad;
    }
    
    // 更新轮播
    function updateSlider(projectId) {
        const galleryCol = document.querySelector(`.project-gallery-col[data-project="${projectId}"]`);
        if (!galleryCol) return;
        
        const sliderContainer = galleryCol.querySelector('.slider-container');
        if (!sliderContainer) return;
        
        const images = sliderContainer.querySelectorAll('img');
        const currentIndex = projectState[projectId].currentIndex;
        
        // 只显示当前图片（其余以透明度 0 退到一边）
        images.forEach(img => img.classList.remove('is-current'));
        if (images[currentIndex]) {
            images[currentIndex].classList.add('is-current');
        }
    }
}); 
