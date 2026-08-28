document.addEventListener('DOMContentLoaded', () => {
    // 변수 초기화
    let columnCount = 1;
    let isInitialLoad = true;
    let gridAnimationInterval;
    let shuffledImageList = []; // 셔플된 이미지 리스트 저장
    let loadedImages = []; // 로딩된 이미지들 저장
    let filterMode = 'blue'; // 색상 필터 상태: 'blue', 'grayscale', 'none'
    
    // 모바일 최적화 변수
    const isMobile = window.innerWidth <= 768;
    const isSlowConnection = navigator.connection && 
        (navigator.connection.effectiveType === 'slow-2g' || 
         navigator.connection.effectiveType === '2g' ||
         navigator.connection.effectiveType === '3g');
    const isFastConnection = navigator.connection && 
        (navigator.connection.effectiveType === '4g' || 
         navigator.connection.effectiveType === '5g');
    
    // 네트워크 상태에 따른 로딩 수 조정
    const initialLoadCount = isMobile ? (isSlowConnection ? 10 : 20) : 50;
    const loadMoreCount = isMobile ? (isSlowConnection ? 5 : 10) : 20;
    let currentLoadedCount = 0;
    let isLoading = false;
    let sequentialLoadingActive = false; // 순차적 로딩 활성화 상태
    
    // DOM 요소
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
    
    // 이미지 목록은 Astro가 빌드 시 최적화(webp)해 window에 주입한다.
    // (기존 하드코딩/생성기 대신 CMS 컬렉션 기반)
    const imageList = (typeof window !== 'undefined' && window.__HOME_IMAGES__) || [];
    
    // Fisher-Yates 셔플
    function shuffle(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    // 표시 크기에 맞는 이미지를 고르도록 알려준다(열 수가 바뀌면 다시 계산)
    function gridSizesAttr() {
        // 처음 벌어지는 애니메이션 동안에는 1열 상태가 잠깐 지나간다.
        // 그때 기준으로 고르면 화면 폭짜리 큰 이미지를 받아버리므로 최종 단수를 기준으로 삼는다.
        const cols = (isInitialLoad ? getDefaultColumns() : columnCount) || 1;
        return `${Math.ceil(100 / cols)}vw`;
    }

    function applyGridSizes() {
        const sizes = gridSizesAttr();
        imageGrid.querySelectorAll('img').forEach((img) => { img.sizes = sizes; });
    }

    // 1. 이미지 그리드 구성
    // 434장을 한 번에 DOM 에 넣으면 휴대폰(특히 iOS 사파리)에서 이미지 디코딩 메모리가
    // 한계를 넘어 탭이 통째로 죽는다. 그래서 화면에 닿는 만큼만 만들어 붙이고,
    // 아래로 내려가면 다음 묶음을 이어 붙인다.
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
        // Photos이 도착하기 전에도 같은 비율의 자리를 차지하게 한다.
        // (자리를 안 잡아두면 Photos이 채워질 때마다 문서가 늘어나 스크롤이 밀린다)
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
        // 화면 아래쪽에 가까워지면 미리 다음 묶음을 준비한다
        sentinelObserver = new IntersectionObserver((entries) => {
            if (!entries.some((e) => e.isIntersecting)) return;
            appendChunk();
            // 열이 많으면 한 묶음으로 화면이 안 채워질 수 있다.
            // 감시점이 여전히 화면 근처면 채워질 때까지 이어 붙인다.
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
        // 확대해서 볼 때의 앞뒤 이동은 화면에 그려진 것과 무관하게 전체를 대상으로 한다
        allImages = shuffledImageList.map((p) => ({ path: p.f }));
        appendChunk();
        setupEndlessAppend();
    }

    // 2. 이미지 삽입 후, 갤러리/애니메이션/이벤트 연결
    let allImages = [];
    let currentImageIndex = 0;
    
    function setupImageEvents() {
        const allImageItems = document.querySelectorAll('.image-item');

        allImageItems.forEach((imageItem) => {
            const img = imageItem.querySelector('img');

            // 이미 처리한 칸은 건너뛴다(묶음을 이어 붙일 때마다 다시 도니까)
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
    
    // 갤러리 뷰 열기
    function openGallery(imagePath) {
        galleryImage.src = imagePath;
        galleryModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // 스크롤 방지
        currentImageIndex = allImages.findIndex(img => img.path === imagePath);
    }
    
    // 갤러리 뷰 닫기
    function closeGallery() {
        galleryModal.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    // 이전 이미지로 이동
    function prevImage() {
        if (currentImageIndex > 0) {
            currentImageIndex--;
            galleryImage.src = allImages[currentImageIndex].path;
        }
    }
    
    // 다음 이미지로 이동
    function nextImage() {
        if (currentImageIndex < allImages.length - 1) {
            currentImageIndex++;
            galleryImage.src = allImages[currentImageIndex].path;
        }
    }
    
    // 그리드 열 변경
    function changeGridColumns(targetColumns = null) {
        if (targetColumns) {
            columnCount = targetColumns;
        }
        
        // 그리드 클래스 업데이트 (loaded 클래스 유지)
        const currentClasses = imageGrid.className.split(' ');
        const loadedClass = currentClasses.includes('loaded') ? 'loaded' : '';
        
        // 모든 columns- 클래스 제거
        currentClasses.forEach(className => {
            if (className.startsWith('columns-')) {
                imageGrid.classList.remove(className);
            }
        });
        
        // 기본 클래스와 loaded 클래스 설정
        imageGrid.className = 'image-grid';
        if (loadedClass) {
            imageGrid.classList.add(loadedClass);
        }
        
        // 새로운 columns- 클래스 추가
        imageGrid.classList.add(`columns-${columnCount}`);
        applyFilterModeClass();
        applyGridSizes();
        
        // 그리드 변경 시 애니메이션 재실행 방지
        const allImageItems = imageGrid.querySelectorAll('.image-item');
        allImageItems.forEach(imageItem => {
            if (!imageItem.classList.contains('loaded')) {
                imageItem.classList.add('loaded');
            }
        });
        
        // 버튼 상태 업데이트
        updateGridButtonStates();
    }

    // 화면 크기에 따른 최대 열 수 계산
    // 처음 들어왔을 때 자리잡는 단수. 상한(getMaxColumns)과는 별개로,
    // Photos이 너무 잘게 보이지 않는 선에서 정한다. +/- 로 더 늘릴 수 있다.
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

    // 그리드 버튼 상태 업데이트
    function updateGridButtonStates() {
        if (gridDecrease && gridIncrease) {
            const maxColumns = getMaxColumns();
            
            // 최소값(1)에 도달하면 감소 버튼 비활성화
            gridDecrease.disabled = columnCount <= 1;
            
            // 현재 화면 크기의 최대값에 도달하면 증가 버튼 비활성화
            gridIncrease.disabled = columnCount >= maxColumns;
            
            // 현재 값이 최대값을 초과하면 조정
            if (columnCount > maxColumns) {
                columnCount = maxColumns;
                changeGridColumns();
            }
        }
    }

    // 그리드 열 감소
    function decreaseGridColumns() {
        if (columnCount > 1) {
            columnCount--;
            changeGridColumns();
        }
    }

    // 그리드 열 증가
    function increaseGridColumns() {
        const maxColumns = getMaxColumns();
        if (columnCount < maxColumns) {
            columnCount++;
            changeGridColumns();
        }
    }

    // 색상 필터 토글 (3단계: 블루 → 흑백 → 필터없음 → 블루)
    function toggleColorFilter() {
        // 필터 모드 순환
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
        
        // 버튼 상태 업데이트
        if (colorFilterToggle) {
            colorFilterToggle.classList.remove('grayscale', 'no-filter');
            if (filterMode === 'grayscale') {
                colorFilterToggle.classList.add('grayscale');
            } else if (filterMode === 'none') {
                colorFilterToggle.classList.add('no-filter');
            }
        }
        
        applyFilterModeClass();

        // 모든 이미지에 필터 적용 (점진적 로딩 지원)
        const allImages = document.querySelectorAll('.image-item img');
        allImages.forEach(img => {
            img.style.filter = getCurrentFilter();
        });
        
        // 필터 변경 시 애니메이션 재실행 방지
        const allImageItems = document.querySelectorAll('.image-item');
        allImageItems.forEach(imageItem => {
            if (!imageItem.classList.contains('loaded')) {
                imageItem.classList.add('loaded');
            }
        });
    }
    
    // 초기 로딩 애니메이션 (개선된 버전)
    function startInitialAnimation() {
        // 로딩 페이지 표시
        loadingPage.style.display = 'flex';
        
        // 1.5초 후 로딩 페이지를 올림 (모바일 최적화)
        setTimeout(() => {
            loadingPage.classList.add('slide-up');
            
            // 애니메이션 완료 후 로딩 페이지 숨기기
            setTimeout(() => {
                loadingPage.style.display = 'none';
                loadingPage.classList.remove('slide-up');
                
                // 이미지 그리드 표시
                imageGrid.classList.add('loaded');
                
                // 그리드 열 변환 애니메이션 시작
                startGridColumnAnimation();
            }, 1000);
        }, 1500); // 모바일에서 더 빠른 로딩
    }


    
    // 그리드 열 변환 애니메이션 시작
    function startGridColumnAnimation() {
        let currentColumn = 1;
        const target = getDefaultColumns();

        if (target <= 1) {
            columnCount = 1;
            changeGridColumns(1);
            isInitialLoad = false;
            return;
        }

        // 2초 동안 1열부터 기본 단수까지 순차적으로 벌어진다
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
    
    // 이벤트 리스너 설정
    function setupEventListeners() {
        // Photos과 화살표 바깥을 누르면 닫힌다(닫기 버튼 없음)
        galleryModal.addEventListener('click', (e) => {
            if (e.target.closest('#gallery-image, .gallery-prev, .gallery-next')) return;
            closeGallery();
        });
        
        // 갤러리 네비게이션 버튼
        galleryPrev.addEventListener('click', prevImage);
        galleryNext.addEventListener('click', nextImage);
        
        // 키보드 이벤트
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
        
        // 그리드 열 수 변경 버튼들
        gridDecrease.addEventListener('click', decreaseGridColumns);
        gridIncrease.addEventListener('click', increaseGridColumns);
        
        // 색상 필터 토글 버튼
        colorFilterToggle.addEventListener('click', toggleColorFilter);
        
        // 윈도우 리사이즈 이벤트
        window.addEventListener('resize', handleWindowResize);
    }
    
    // 윈도우 리사이즈 핸들러
    function handleWindowResize() {
        // 디바운싱을 위한 타이머
        clearTimeout(window.resizeTimer);
        window.resizeTimer = setTimeout(() => {
            updateGridButtonStates();
        }, 250);
    }
    
    // 페이지 초기화 (개선된 버전)
    async function initializePage() {
        // 1. 이미지 리스트 셔플
        shuffledImageList = shuffle(imageList);
        
        // 2. 초기 애니메이션 시작 (2초 후 로딩 페이지 올라감)
        startInitialAnimation();
        
        // 3. 점진적 이미지 로딩 (모바일 최적화)
        await loadImagesProgressively();
        
        // 4. 이벤트 설정
        setupImageEvents();
        
        // 5. 이벤트 리스너 설정
        setupEventListeners();
        
        // 6. 스크롤 이벤트 리스너 추가 (무한 스크롤)
        setupScrollListener();
        
        // 7. 초기 버튼 상태 설정
        updateGridButtonStates();
    }
    
    // 이미지 로딩: 그리드만 만들고 내려받기는 브라우저에 맡긴다
    async function loadImagesProgressively() {
        renderImages();
        console.log(`✅ 그리드 구성 완료 (${shuffledImageList.length}장, 화면에 보이는 것부터 로드)`);
    }

    // (사용 안 함) 예전 선다운로드 방식의 잔재 — 브라우저 지연 로딩으로 대체됨
    function loadImageBatch() {}

    // 스크롤 리스너 설정
    function setupScrollListener() {
        let scrollTimeout;
        
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                checkAndLoadMoreImages();
            }, 100);
        });
    }
    
    // (사용 안 함) 예전 선다운로드 방식의 잔재 — 브라우저 지연 로딩으로 대체됨
    function startSequentialLoading() {}

    async function checkAndLoadMoreImages() {
        if (isLoading || currentLoadedCount >= shuffledImageList.length) {
            return;
        }
        
        // 순차적 로딩이 활성화되어 있으면 스크롤 기반 로딩은 건너뛰기
        if (sequentialLoadingActive) {
            return;
        }
        
        // 스크롤이 하단에 가까워지면 추가 로딩
        const scrollPosition = window.scrollY + window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        
        if (scrollPosition >= documentHeight - 500) { // 500px 전에 로딩 시작
            await loadMoreImages();
        }
    }
    
    // 추가 이미지 로딩 (스크롤 기반 - 순차적 로딩과 병행)
    async function loadMoreImages() {
        if (isLoading) return;
        
        // 이미 순차적 로딩으로 모든 이미지가 로드되었으면 스킵
        if (currentLoadedCount >= shuffledImageList.length) {
            return;
        }
        
        isLoading = true;
        const startIndex = currentLoadedCount;
        const endIndex = Math.min(currentLoadedCount + loadMoreCount, shuffledImageList.length);
        const newImages = shuffledImageList.slice(startIndex, endIndex);
        
        console.log(`📥 스크롤 기반 추가 로딩: ${startIndex + 1}~${endIndex} (${newImages.length}개)`);
        
        await loadImageBatch(newImages, startIndex);
        currentLoadedCount = endIndex;
        
        // 그리드 업데이트
        updateImageGrid();
        
        isLoading = false;
        
        console.log(`✅ 스크롤 기반 로딩 완료. 총 ${currentLoadedCount}/${shuffledImageList.length}개 로드됨`);
        
        // 아직 로드할 이미지가 있으면 순차적 로딩 재시작
        if (currentLoadedCount < shuffledImageList.length) {
            setTimeout(() => {
                loadNextBatch();
            }, 100);
        }
    }
    
    // 현재 필터 상태 반환
    // 현재 색상 모드를 격자 클래스로도 표시한다.
    // 호버했을 때 '다른 모드로 바뀌는' 반응을 CSS 가 알아야 하기 때문이다.
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
    
    // 새로 추가된 이미지들에만 이벤트 설정
    function setupNewImageEvents(startIndex) {
        const newImageItems = imageGrid.querySelectorAll('.image-item');
        const newItems = Array.from(newImageItems).slice(startIndex);
        
        newItems.forEach((imageItem) => {
            const img = imageItem.querySelector('img');
            
            // 새 이미지에 애니메이션 적용
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
            
            // 클릭 이벤트 추가
            img.addEventListener('click', () => {
                openGallery(img.dataset.full);
            });
        });
        
        // allImages 배열 업데이트 (새 이미지들만 추가)
        const newImageData = newItems.map(item => ({
            element: item,
            path: item.querySelector('img').src
        }));
        
        allImages = allImages.concat(newImageData);
    }
    
    // 이미지 그리드 업데이트 (기존 이미지 유지, 새 이미지만 추가)
    function updateImageGrid() {
        const loadedImageElements = loadedImages
            .filter(img => img && img.loaded && img.element)
            .map(img => img.element);
        
        // 현재 그리드에 있는 이미지 수 확인
        const currentGridItems = imageGrid.querySelectorAll('.image-item');
        const currentCount = currentGridItems.length;
        
        // 새로 추가할 이미지만 처리
        const newImages = loadedImageElements.slice(currentCount);
        
        // 새 이미지들만 그리드에 추가
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
        
        // 새로 추가된 이미지들에만 이벤트 설정
        setupNewImageEvents(currentCount);
    }
    
    // 페이지 초기화 실행
    initializePage();
});
