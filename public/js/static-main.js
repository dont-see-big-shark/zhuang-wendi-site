document.addEventListener('DOMContentLoaded', () => {
    // 变量初始化
    let columnCount = 1;
    let isInitialLoad = true;
    let gridAnimationInterval;
    let shuffledImageList = []; // 打乱后的图片列表
    let loadedImages = []; // 已加载的图片
    let filterMode = 'blue'; // 滤镜状态: 'blue', 'grayscale', 'none'
    
    // 移动端优化变量
    const isMobile = window.innerWidth <= 768;
    const isSlowConnection = navigator.connection && 
        (navigator.connection.effectiveType === 'slow-2g' || 
         navigator.connection.effectiveType === '2g' ||
         navigator.connection.effectiveType === '3g');
    const isFastConnection = navigator.connection && 
        (navigator.connection.effectiveType === '4g' || 
         navigator.connection.effectiveType === '5g');
    
    // 根据网络状态调整加载数量
    const initialLoadCount = isMobile ? (isSlowConnection ? 10 : 20) : 50;
    const loadMoreCount = isMobile ? (isSlowConnection ? 5 : 10) : 20;
    let currentLoadedCount = 0;
    let isLoading = false;
    let sequentialLoadingActive = false; // 顺序加载是否启用
    
    // DOM 元素
    const imageGrid = document.getElementById('image-grid');
    const loadingIndicator = document.getElementById('loading-indicator');
    const galleryModal = document.getElementById('gallery-modal');
    const galleryImage = document.getElementById('gallery-image');
    const galleryPrev = document.getElementById('gallery-prev');
    const galleryNext = document.getElementById('gallery-next');
    const gridDecrease = document.getElementById('grid-decrease');
    const gridIncrease = document.getElementById('grid-increase');
    const colorFilterToggle = document.getElementById('color-filter-toggle');
    const loadingPage = document.getElementById('loading-page');
    
    // 图片列表由 Astro 构建时优化（webp）后注入 window。
    // （基于 CMS 集合，替代原先的硬编码/生成器）
    const imageList = (typeof window !== 'undefined' && window.__HOME_IMAGES__) || [];
    
    // Fisher-Yates 洗牌算法
    function shuffle(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    // 告诉浏览器按显示尺寸选图（列数变化时重新计算）
    function gridSizesAttr() {
        // 展开动画期间会短暂经过 1 列状态。
        // 若按当时宽度选图会下过大图，所以始终按最终列数计算。
        const cols = (isInitialLoad ? getDefaultColumns() : columnCount) || 1;
        return `${Math.ceil(100 / cols)}vw`;
    }

    function applyGridSizes() {
        const sizes = gridSizesAttr();
        imageGrid.querySelectorAll('img').forEach((img) => { img.sizes = sizes; });
    }

    // 1. 图片网格构建
    // 几百张图一次性塞进 DOM，手机（尤其 iOS Safari）的图片解码内存
    // 会超限导致整个标签页崩溃。因此只创建视口内的部分，
    // 向下滚动时再追加下一批。
    const CHUNK = isMobile ? 24 : 60;
    let renderedCount = 0;
    let sentinel = null;
    let sentinelObserver = null;

    function createItem(photo, index) {
        const div = document.createElement('div');
        div.className = 'image-item';
        div.dataset.index = index;

        const img = document.createElement('img');
        img.alt = "ZHUANG.WENDI's Photos";
        img.loading = 'lazy';
        img.decoding = 'async';
        // 图片到达前先按相同比例占位。
        // （不占位的话，每填入一张图文档高度都会变化，滚动位置会被顶走）
        if (photo.w && photo.h) {
            img.width = photo.w;
            img.height = photo.h;
        }
        if (photo.ss) img.srcset = photo.ss;
        img.sizes = gridSizesAttr();
        img.src = photo.t;
        img.dataset.full = photo.f;
        img.style.filter = getCurrentFilter();

        div.appendChild(img);
        return div;
    }

    function appendChunk() {
        const total = shuffledImageList.length;
        if (renderedCount >= total) {
            if (sentinelObserver && sentinel) sentinelObserver.unobserve(sentinel);
            if (sentinel) sentinel.style.display = 'none';
            return;
        }
        const end = Math.min(renderedCount + CHUNK, total);
        const frag = document.createDocumentFragment();
        for (let i = renderedCount; i < end; i++) frag.appendChild(createItem(shuffledImageList[i], i));
        imageGrid.appendChild(frag);
        renderedCount = end;
        currentLoadedCount = renderedCount;
        setupImageEvents();
    }

    function setupEndlessAppend() {
        if (!sentinel) {
            sentinel = document.createElement('div');
            sentinel.id = 'grid-sentinel';
            sentinel.style.cssText = 'width:100%;height:1px;';
            imageGrid.parentNode.insertBefore(sentinel, imageGrid.nextSibling);
        }
        sentinel.style.display = '';
        if (sentinelObserver) sentinelObserver.disconnect();
        // 接近视口底部时提前准备下一批
        sentinelObserver = new IntersectionObserver((entries) => {
            if (!entries.some((e) => e.isIntersecting)) return;
            appendChunk();
            // 列数多时一批可能填不满一屏。
            // 哨兵元素仍在视口附近就继续追加，直到填满。
            const fill = () => {
                if (renderedCount >= shuffledImageList.length) return;
                if (sentinel.getBoundingClientRect().top < window.innerHeight + 800) {
                    appendChunk();
                    setTimeout(fill, 0);
                }
            };
            setTimeout(fill, 0);
        }, { rootMargin: '800px 0px' });
        sentinelObserver.observe(sentinel);
    }

    function renderImages() {
        imageGrid.innerHTML = '';
        renderedCount = 0;
        // 放大查看时的前后翻页以全部图片为准，与当前已渲染的部分无关
        allImages = shuffledImageList.map((p) => ({ path: p.f }));
        appendChunk();
        setupEndlessAppend();
    }

    // 2. 图片插入后，连接画廊/动画/事件
    let allImages = [];
    let currentImageIndex = 0;
    
    function setupImageEvents() {
        const allImageItems = document.querySelectorAll('.image-item');

        allImageItems.forEach((imageItem) => {
            const img = imageItem.querySelector('img');

            // 已处理的格子直接跳过（每追加一批都会重新触发）
            if (imageItem.dataset.bound === '1') return;
            imageItem.dataset.bound = '1';
            
            if (img.complete) {
                setTimeout(() => {
                    imageItem.classList.add('loaded');
                }, Math.random() * 500);
            } else {
                img.onload = function() {
                    setTimeout(() => {
                        imageItem.classList.add('loaded');
                    }, Math.random() * 500);
                };
            }
            img.addEventListener('click', () => {
                openGallery(img.dataset.full);
            });
        });
    }
    
    // 打开画廊视图
    function openGallery(imagePath) {
        galleryImage.src = imagePath;
        galleryModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // 禁止滚动
        currentImageIndex = allImages.findIndex(img => img.path === imagePath);
    }
    
    // 关闭画廊视图
    function closeGallery() {
        galleryModal.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    // 上一张图片
    function prevImage() {
        if (currentImageIndex > 0) {
            currentImageIndex--;
            galleryImage.src = allImages[currentImageIndex].path;
        }
    }
    
    // 下一张图片
    function nextImage() {
        if (currentImageIndex < allImages.length - 1) {
            currentImageIndex++;
            galleryImage.src = allImages[currentImageIndex].path;
        }
    }
    
    // 修改网格列数
    function changeGridColumns(targetColumns = null) {
        if (targetColumns) {
            columnCount = targetColumns;
        }
        
        // 更新网格类名（保留 loaded 类）
        const currentClasses = imageGrid.className.split(' ');
        const loadedClass = currentClasses.includes('loaded') ? 'loaded' : '';
        
        // 移除所有 columns- 类
        currentClasses.forEach(className => {
            if (className.startsWith('columns-')) {
                imageGrid.classList.remove(className);
            }
        });
        
        // 设置基础类和 loaded 类
        imageGrid.className = 'image-grid';
        if (loadedClass) {
            imageGrid.classList.add(loadedClass);
        }
        
        // 添加新的 columns- 类
        imageGrid.classList.add(`columns-${columnCount}`);
        applyFilterModeClass();
        applyGridSizes();
        
        // 防止列数变化时动画重放
        const allImageItems = imageGrid.querySelectorAll('.image-item');
        allImageItems.forEach(imageItem => {
            if (!imageItem.classList.contains('loaded')) {
                imageItem.classList.add('loaded');
            }
        });
        
        // 更新按钮状态
        updateGridButtonStates();
    }

    // 按屏幕宽度计算默认列数
    // 这是进入页面时铺开的列数，与上限（getMaxColumns）分开：
    // 以照片不至于过碎为准，用户仍可用 +/- 继续调整。
    function getDefaultColumns() {
        const w = window.innerWidth;
        if (w <= 360) return 2;
        if (w <= 480) return 3;
        if (w <= 768) return 3;
        if (w <= 992) return 6;
        if (w <= 1200) return 7;
        return 8;
    }

    function getMaxColumns() {
        const screenWidth = window.innerWidth;
        
        if (screenWidth <= 360) {
            return 4;
        } else if (screenWidth <= 480) {
            return 5;
        } else if (screenWidth <= 576) {
            return 6;
        } else if (screenWidth <= 768) {
            return 8;
        } else if (screenWidth <= 992) {
            return 10;
        } else if (screenWidth <= 1200) {
            return 12;
        } else if (screenWidth <= 1400) {
            return 14;
        } else {
            return 16;
        }
    }

    // 网格按钮状态更新
    function updateGridButtonStates() {
        if (gridDecrease && gridIncrease) {
            const maxColumns = getMaxColumns();
            
            // 到达最小值（1）时禁用减号按钮
            gridDecrease.disabled = columnCount <= 1;
            
            // 到达当前屏幕的最大列数时禁用加号按钮
            gridIncrease.disabled = columnCount >= maxColumns;
            
            // 当前值超过最大值时进行修正
            if (columnCount > maxColumns) {
                columnCount = maxColumns;
                changeGridColumns();
            }
        }
    }

    // 网格列数减一
    function decreaseGridColumns() {
        if (columnCount > 1) {
            columnCount--;
            changeGridColumns();
        }
    }

    // 网格列数加一
    function increaseGridColumns() {
        const maxColumns = getMaxColumns();
        if (columnCount < maxColumns) {
            columnCount++;
            changeGridColumns();
        }
    }

    // 颜色滤镜切换（三档: 蓝调 → 黑白 → 原色 → 蓝调）
    function toggleColorFilter() {
        // 循环切换滤镜模式
        switch (filterMode) {
            case 'blue':
                filterMode = 'grayscale';
                break;
            case 'grayscale':
                filterMode = 'none';
                break;
            case 'none':
                filterMode = 'blue';
                break;
        }
        
        // 更新按钮状态
        if (colorFilterToggle) {
            colorFilterToggle.classList.remove('grayscale', 'no-filter');
            if (filterMode === 'grayscale') {
                colorFilterToggle.classList.add('grayscale');
            } else if (filterMode === 'none') {
                colorFilterToggle.classList.add('no-filter');
            }
        }
        
        applyFilterModeClass();

        // 给所有图片套用滤镜（兼容渐进加载）
        const allImages = document.querySelectorAll('.image-item img');
        allImages.forEach(img => {
            img.style.filter = getCurrentFilter();
        });
        
        // 防止切换滤镜时动画重放
        const allImageItems = document.querySelectorAll('.image-item');
        allImageItems.forEach(imageItem => {
            if (!imageItem.classList.contains('loaded')) {
                imageItem.classList.add('loaded');
            }
        });
    }
    
    // 初始加载动画（改进版）
    function startInitialAnimation() {
        // 显示加载页
        loadingPage.style.display = 'flex';
        
        // 1.5 秒后上滑隐藏加载页（移动端优化）
        setTimeout(() => {
            loadingPage.classList.add('slide-up');
            
            // 动画结束后隐藏加载页
            setTimeout(() => {
                loadingPage.style.display = 'none';
                loadingPage.classList.remove('slide-up');
                
                // 显示图片网格
                imageGrid.classList.add('loaded');
                
                // 开始网格列数展开动画
                startGridColumnAnimation();
            }, 1000);
        }, 1500); // 移动端使用更快的节奏
    }


    
    // 开始网格列数展开动画
    function startGridColumnAnimation() {
        let currentColumn = 1;
        const target = getDefaultColumns();

        if (target <= 1) {
            columnCount = 1;
            changeGridColumns(1);
            isInitialLoad = false;
            return;
        }

        // 用 2 秒从 1 列逐步展开到默认列数
        gridAnimationInterval = setInterval(() => {
            currentColumn++;
            if (currentColumn >= target) {
                clearInterval(gridAnimationInterval);
                columnCount = target;
                changeGridColumns(target);
                isInitialLoad = false;
                return;
            }

            changeGridColumns(currentColumn);
        }, 2000 / (target - 1));
    }
    
    // 事件监听设置
    function setupEventListeners() {
        // 点击图片或箭头以外的区域时关闭画廊（没有关闭按钮）
        galleryModal.addEventListener('click', (e) => {
            if (e.target.closest('#gallery-image, .gallery-prev, .gallery-next')) return;
            closeGallery();
        });
        
        // 画廊翻页按钮
        galleryPrev.addEventListener('click', prevImage);
        galleryNext.addEventListener('click', nextImage);
        
        // 键盘事件
        document.addEventListener('keydown', (e) => {
            if (galleryModal.classList.contains('active')) {
                if (e.key === 'Escape') {
                    closeGallery();
                } else if (e.key === 'ArrowLeft') {
                    prevImage();
                } else if (e.key === 'ArrowRight') {
                    nextImage();
                }
            }
        });
        
        // 网格列数增减按钮
        gridDecrease.addEventListener('click', decreaseGridColumns);
        gridIncrease.addEventListener('click', increaseGridColumns);
        
        // 颜色滤镜切换按钮
        colorFilterToggle.addEventListener('click', toggleColorFilter);
        
        // 窗口缩放事件
        window.addEventListener('resize', handleWindowResize);
    }
    
    // 窗口缩放处理
    function handleWindowResize() {
        // 防抖定时器
        clearTimeout(window.resizeTimer);
        window.resizeTimer = setTimeout(() => {
            updateGridButtonStates();
        }, 250);
    }
    
    // 页面初始化（改进版）
    async function initializePage() {
        // 1. 打乱图片列表
        shuffledImageList = shuffle(imageList);
        
        // 2. 启动初始动画（2 秒后上滑加载页）
        startInitialAnimation();
        
        // 3. 渐进式图片加载（移动端优化）
        await loadImagesProgressively();
        
        // 4. 绑定事件
        setupImageEvents();
        
        // 5. 设置事件监听
        setupEventListeners();
        
        // 6. 添加滚动监听（无限滚动）
        setupScrollListener();
        
        // 7. 初始化按钮状态
        updateGridButtonStates();
    }
    
    // 图片加载: 只构建网格，下载交给浏览器
    async function loadImagesProgressively() {
        renderImages();
        console.log(`✅ 网格构建完成 (${shuffledImageList.length} 张，从视口内的开始加载)`);
    }

    // （已弃用）旧版预下载逻辑的残留 —— 已由浏览器原生懒加载取代
    function loadImageBatch() {}

    // 滚动监听设置
    function setupScrollListener() {
        let scrollTimeout;
        
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                checkAndLoadMoreImages();
            }, 100);
        });
    }
    
    // （已弃用）旧版预下载逻辑的残留 —— 已由浏览器原生懒加载取代
    function startSequentialLoading() {}

    async function checkAndLoadMoreImages() {
        if (isLoading || currentLoadedCount >= shuffledImageList.length) {
            return;
        }
        
        // 顺序加载启用时跳过滚动触发
        if (sequentialLoadingActive) {
            return;
        }
        
        // 滚动接近底部时加载更多
        const scrollPosition = window.scrollY + window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        
        if (scrollPosition >= documentHeight - 500) { // 提前 500px 开始加载
            await loadMoreImages();
        }
    }
    
    // 追加图片加载（滚动触发，与顺序加载并行）
    async function loadMoreImages() {
        if (isLoading) return;
        
        // 顺序加载已覆盖全部图片时直接跳过
        if (currentLoadedCount >= shuffledImageList.length) {
            return;
        }
        
        isLoading = true;
        const startIndex = currentLoadedCount;
        const endIndex = Math.min(currentLoadedCount + loadMoreCount, shuffledImageList.length);
        const newImages = shuffledImageList.slice(startIndex, endIndex);
        
        console.log(`📥 滚动追加加载: ${startIndex + 1}~${endIndex} (${newImages.length} 张)`);
        
        await loadImageBatch(newImages, startIndex);
        currentLoadedCount = endIndex;
        
        // 更新网格
        updateImageGrid();
        
        isLoading = false;
        
        console.log(`✅ 滚动加载完成. 已加载 ${currentLoadedCount}/${shuffledImageList.length} 张`);
        
        // 还有未加载的图片时恢复顺序加载
        if (currentLoadedCount < shuffledImageList.length) {
            setTimeout(() => {
                loadNextBatch();
            }, 100);
        }
    }
    
    // 返回当前滤镜状态
    // 同时把当前滤镜模式写进网格类名。
    // 这样 CSS 才能实现"悬停预览其他模式"的反馈。
    function applyFilterModeClass() {
        imageGrid.classList.remove('mode-blue', 'mode-grayscale', 'mode-none');
        imageGrid.classList.add('mode-' + filterMode);
    }

    function getCurrentFilter() {
        switch (filterMode) {
            case 'grayscale':
                return 'grayscale(100%)';
            case 'none':
                return 'none';
            default:
                return 'sepia(100%) hue-rotate(180deg) saturate(200%)';
        }
    }
    
    // 只给新增的图片绑定事件
    function setupNewImageEvents(startIndex) {
        const newImageItems = imageGrid.querySelectorAll('.image-item');
        const newItems = Array.from(newImageItems).slice(startIndex);
        
        newItems.forEach((imageItem) => {
            const img = imageItem.querySelector('img');
            
            // 给新图片套用入场动画
            if (img.complete) {
                setTimeout(() => {
                    imageItem.classList.add('loaded');
                }, Math.random() * 500);
            } else {
                img.onload = function() {
                    setTimeout(() => {
                        imageItem.classList.add('loaded');
                    }, Math.random() * 500);
                };
            }
            
            // 绑定点击事件
            img.addEventListener('click', () => {
                openGallery(img.dataset.full);
            });
        });
        
        // 更新 allImages 数组（只追加新图片）
        const newImageData = newItems.map(item => ({
            element: item,
            path: item.querySelector('img').src
        }));
        
        allImages = allImages.concat(newImageData);
    }
    
    // 更新图片网格（保留已有图片，只追加新的）
    function updateImageGrid() {
        const loadedImageElements = loadedImages
            .filter(img => img && img.loaded && img.element)
            .map(img => img.element);
        
        // 检查网格中现有图片数量
        const currentGridItems = imageGrid.querySelectorAll('.image-item');
        const currentCount = currentGridItems.length;
        
        // 只处理新增的图片
        const newImages = loadedImageElements.slice(currentCount);
        
        // 只把新图片加进网格
        newImages.forEach((img, index) => {
            const actualIndex = currentCount + index;
            const imageItem = document.createElement('div');
            imageItem.className = 'image-item';
            imageItem.dataset.index = actualIndex;
            
            const imgClone = img.cloneNode(true);
            imgClone.style.filter = getCurrentFilter();
            imageItem.appendChild(imgClone);
            
            imageGrid.appendChild(imageItem);
        });
        
        // 只给新增的图片绑定事件
        setupNewImageEvents(currentCount);
    }
    
    // 执行页面初始化
    initializePage();
});
