/* =====================================================================
   ⚙️ 동기화 설정 — 이 트립 전용 구글 앱스 스크립트를 새로 배포한 뒤
   그 웹앱 URL을 여기에 넣으면 동기화 버튼이 바로 동작합니다.
   (GoogleAppsScript_Code_Taiwan.gs 참고. 배포 전에는 비워두면 되고,
    이 경우 "지금 업로드/불러오기"를 누르면 안내 문구만 뜨고 앱은 정상 동작합니다)
===================================================================== */
const DEFAULT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwbpS-RMq6Ur1_Yi_OZQYZtFQnwkGCr_GyV8u9ckqspN8SRzQ7FeBR8sEuK_dNxSHTsGQ/exec';

// 통화 환산 기준 (1단위당 원화, 2026년 9월 기준 대략치)
const FX = { TWD: 43, KRW: 1 };

// 가계부 카테고리 (EuroTrip2026과 동일 체계 유지, 대만 여행에도 그대로 적용)
const EXPENSE_CATEGORIES = ['식비','교통','숙박','쇼핑','관광입장료','기타'];
const CATEGORY_EMOJI = { '식비':'🍽️', '교통':'🚌', '숙박':'🛏️', '쇼핑':'🛍️', '관광입장료':'🎫', '기타':'📦' };
// 타임라인 카드 태그 → 가계부 카테고리 매핑(마이그레이션/신규 지출 기본값에 사용)
function tagToCategory(tag){
  const map = { '이동':'교통', '관광':'관광입장료', '식사':'식비', '숙소':'숙박', '쇼핑':'쇼핑' };
  return map[tag] || '기타';
}

// 여행 전 기간에도, 대만 도착 이후에도 항상 '대만 현지시간' 기준으로 오늘 날짜를 판단합니다. (Asia/Taipei, UTC+8, 서머타임 없음)
function todayInTaipei(){
  return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Taipei', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
}

/* =====================================================================
   SEED DATA — 가오슝 2박3일 (2026-09-17 ~ 09-19) 일정 기준
===================================================================== */
const SEED_DAYS = [
{date:'2026-09-17', label:'9/17(목)', city:'가오슝', country:'대만', stay:'그리트 인(Greet Inn)', checkin:true, blocks:[
  {period:'오후', tag:'이동', title:'인천→가오슝 도착 · 공항→호텔 이동', time:'13:05–16:30', place:'가오슝 국제공항 → 그리트 인', tip:'입국심사·수하물 수령(~30~40분) 후 택시 이동 권장(약 20분, NT$300 내외, 짐 있어 MRT보다 편함). 호텔은 첸진구, 시의회역(오렌지라인) 도보 3분·류허야시장 도보 5분.', map:'Greet Inn Kaohsiung'},
  {period:'저녁', tag:'식사', title:'★ 류허(六合) 야시장 저녁 겸 먹거리 투어', time:'18:00', place:'류허 야시장', tip:'호텔 바로 앞. 첫날은 짐 풀고 가볍게 즐기기 좋은 코스.', map:'Liuhe Night Market Kaohsiung'},
  {period:'밤', tag:'관광', title:'메이리다오역 光之穹頂(빛의 돔) 야경', time:'20:30', place:'메이리다오역', tip:'MRT 1정거장, 세계 최대 규모 스테인드글라스 천장 야경.', map:'Formosa Boulevard Station Dome of Light Kaohsiung'},
]},
{date:'2026-09-18', label:'9/18(금)', city:'가오슝', country:'대만', stay:'그리트 인(Greet Inn)', blocks:[
  {period:'아침', tag:'식사', title:'조식', time:'08:00', place:'숙소', tip:'', map:''},
  {period:'오전', tag:'이동', title:'MRT 시즈완역 이동 · 구산 페리 승선', time:'09:00–09:40', place:'시즈완역 → 구산 페리 터미널', tip:'시의회역→시즈완역, 환승 포함 약 25분. 페리는 5분, 이지카드/아이패스면 편도 NT$20.', map:'Gushan Ferry Pier Kaohsiung'},
  {period:'오전', tag:'관광', title:'치진섬 - 치허우 포대 & 별빛 터널', time:'10:00–12:00', place:'치진섬', tip:'치진 등대까지 이어지는 언덕길, 항구 전망 좋음.', map:'Cijin Fort Kaohsiung'},
  {period:'오후', tag:'식사', title:'★ 치진 해산물 거리 점심', time:'12:00', place:'치진 해산물 거리', tip:'해산물 국수·튀김 등 현지 맛집 밀집.', map:'Cijin Seafood Street Kaohsiung'},
  {period:'오후', tag:'관광', title:'하마싱 철도문화원구', time:'14:00', place:'하마싱 철도문화원구', tip:'페리로 구산 복귀 후 도보 이동, 옛 철도역 전시.', map:'Hamasen Railway Cultural Park Kaohsiung'},
  {period:'오후', tag:'관광', title:'보얼예술특구(駁二藝術特區)', time:'15:00', place:'보얼예술특구', tip:'창고 개조 전시·소품샵, 도보/자전거 산책 좋음.', map:'Pier-2 Art Center Kaohsiung'},
  {period:'저녁', tag:'관광', title:'아이허(愛河) 강변 산책 & 시즈완 노을', time:'17:00–18:30', place:'아이허 강변 / 시즈완', tip:'항구도시 대표 일몰 명소. 강변 따라 도보 또는 유람선.', map:'Love River Kaohsiung'},
  {period:'저녁', tag:'식사', title:'★ 저녁식사(옌청 맛집)', time:'19:00', place:'옌청/보얼 인근', tip:'보얼·옌청 인근 로컬 맛집.', map:''},
  {period:'밤', tag:'쇼핑', title:'(선택) 루이펑 야시장', time:'21:00', place:'루이펑 야시장', tip:'금요일 영업, 현지인 인기 야시장. 체력 보고 선택(월/수 휴무 야시장이라 이번 트립엔 금요일이 유일한 기회).', map:'Ruifeng Night Market Kaohsiung'},
]},
{date:'2026-09-19', label:'9/19(토)', city:'가오슝 → 인천', country:'귀국일', stay:'그리트 인(Greet Inn, 체크아웃)', blocks:[
  {period:'아침', tag:'식사', title:'조식 & 체크아웃', time:'08:00', place:'숙소', tip:'짐은 프런트에 보관 요청.', map:''},
  {period:'오전', tag:'관광', title:'가오슝 역사박물관 or 중앙공원 산책', time:'09:00', place:'가오슝 역사박물관', tip:'호텔 도보 15분권, 가벼운 관광.', map:'Kaohsiung Museum of History'},
  {period:'오전', tag:'쇼핑', title:'85타워 전망 / 기념품 쇼핑', time:'11:00', place:'85타워 인근', tip:'가오슝 랜드마크, 대립백화점 인근.', map:'85 Sky Tower Kaohsiung'},
  {period:'오후', tag:'식사', title:'★ 점심(우육면 등 로컬 맛집)', time:'12:00', place:'호텔 인근', tip:'마지막 식사는 부담없이 로컬 맛집으로.', map:''},
  {period:'오후', tag:'이동', title:'짐 찾고 공항 이동', time:'13:00', place:'그리트 인 → 가오슝 국제공항', tip:'택시 또는 MRT(메이리다오 환승), 약 20~30분.', map:'Kaohsiung International Airport'},
  {period:'오후', tag:'이동', title:'가오슝 → 인천 출발', time:'16:10', place:'가오슝 국제공항', tip:'국제선 2시간 전 도착 기준. 20:00 인천 도착 예정.', map:''},
]},
];

const SEED_POOL = [
 {city:'가오슝', title:'루이펑 야시장(瑞豐夜市)', desc:'가오슝 최대 규모 현지인 야시장. 화·목·금·토·일 영업(월·수 휴무). 톈스지파이(닭튀김) 유명.', map:'Ruifeng Night Market Kaohsiung'},
 {city:'가오슝', title:'연지담(蓮池潭) 용호탑', desc:'용 입으로 들어가 호랑이 입으로 나오는 액운막이 명소. 쭤잉 지역, 루이펑 야시장과 묶기 좋음.', map:'Lotus Pond Dragon Tiger Pagodas Kaohsiung'},
 {city:'가오슝', title:'가오슝 뮤직센터(高雄流行音樂中心)', desc:'아이허 하구의 독특한 건축, 산책하기 좋은 야경 명소.', map:'Kaohsiung Music Center'},
 {city:'가오슝', title:'85 스카이타워 전망대', desc:'가오슝 랜드마크 고층빌딩, 야경 전망.', map:'85 Sky Tower Kaohsiung'},
 {city:'가오슝', title:'가오슝 역사박물관', desc:'옛 시청사 건물, 무료입장, 호텔에서 도보 15분권.', map:'Kaohsiung Museum of History'},
 {city:'가오슝', title:'싱룽거(興隆居)', desc:'호텔 도보 1분, 대만식 아침식사(딴빙/떠우장) 맛집.', map:'Sing Long Ju Kaohsiung'},
 {city:'가오슝', title:'85도씨 커피(85度C)', desc:'호텔 도보 5분, 대만 국민 카페 체인. 커피+빵 간단 아침/간식.', map:'85C Bakery Cafe Kaohsiung Qianjin'},
 {city:'가오슝', title:'다관백화점 · 한신백화점', desc:'가오슝 대표 쇼핑몰, 실내 냉방 완비라 더운 낮에 쉬어가기 좋음.', map:'Han Shin Department Store Kaohsiung'},
];

const SEED_SHOPPING = [
 {country:'대만', city:'가오슝', items:['펑리수(鳳梨酥, 파인애플케이크) — 써니힐/기미당 등','누가크래커(牛軋餅)','우육면 즉석 스프패키지','고산 우롱차·동방미인차','대만 특산 김(海苔) 과자','타이거 릴리 육포(肉乾)','약국 화장품 — 만다린덕 마스크팩, 니베아 대만 한정판','편의점 특산 — 두유/도우화, 대만맥주(台灣啤酒)','85도씨/루이싱 커피 원두·드립백'], loc:'추천 쇼핑지: 류허야시장, 한신백화점, 다관백화점, 공항 면세점'},
];

const SEED_CHECKLIST = [
 {cat:'Basic Item', items:['여권(유효기간 6개월 이상 확인)','항공권(전자티켓)','여권사본','여행자 보험','유심/로밍']},
 {cat:'Reservation', items:['왕복 항공권','그리트 인 호텔 예약확인서']},
 {cat:'Payment Item', items:['트래블월렛/트래블로그 카드','대만달러(TWD) 현금 소액 환전','예비 카드']},
 {cat:'Electric Item', items:['충전기','멀티탭','보조배터리']},
 {cat:'Sanitary', items:['세면도구','로션','렌즈','손소독제','인공눈물','립밤']},
 {cat:'Sun Protect', items:['모자','선크림','선글라스']},
 {cat:'Theft Protect', items:['소형열쇠','휴대폰 분실방지','슬링백']},
 {cat:'Clothes', items:['속옷','양말','얇은 긴팔(실내 냉방 대비)','반팔/반바지','우산 or 우비(9월 소나기 대비)','편한 신발']},
 {cat:'Medicine', items:['종합감기약','지사제','소화제','해열진통제','밴드','모기기피제']},
 {cat:'etc', items:['지퍼백/비닐봉지','동전지갑(야시장 현금 결제용)','이지카드/아이패스(현지 구매)']},
];

/* =====================================================================
   여행 회화 (중국어 표준어 · 대만) — 가오슝 여행 기준 기본 표현
===================================================================== */
const PHRASES = [
 {cat:'인사 & 자기소개', kr:'안녕하세요.', zh:'你好。', py:'Nǐ hǎo.'},
 {cat:'인사 & 자기소개', kr:'감사합니다.', zh:'謝謝。', py:'Xièxie.'},
 {cat:'인사 & 자기소개', kr:'천만에요.', zh:'不客氣。', py:'Bú kèqi.'},
 {cat:'인사 & 자기소개', kr:'죄송합니다. / 실례합니다.', zh:'不好意思。', py:'Bù hǎoyìsi.'},
 {cat:'인사 & 자기소개', kr:'괜찮아요.', zh:'沒關係。', py:'Méi guānxi.'},
 {cat:'인사 & 자기소개', kr:'안녕히 계세요. / 안녕히 가세요.', zh:'再見。', py:'Zàijiàn.'},
 {cat:'인사 & 자기소개', kr:'저는 한국에서 왔어요.', zh:'我從韓國來。', py:'Wǒ cóng Hánguó lái.'},
 {cat:'인사 & 자기소개', kr:'저는 중국어를 잘 못해요.', zh:'我不太會說中文。', py:'Wǒ bú tài huì shuō zhōngwén.'},
 {cat:'인사 & 자기소개', kr:'영어 하시는 분 계신가요?', zh:'請問有人會說英文嗎？', py:'Qǐngwèn yǒu rén huì shuō yīngwén ma?'},
 {cat:'기본 표현', kr:'네.', zh:'是的。/ 對。', py:'Shì de. / Duì.'},
 {cat:'기본 표현', kr:'아니요.', zh:'不是。/ 不對。', py:'Bú shì. / Bú duì.'},
 {cat:'기본 표현', kr:'괜찮아요. / 됐어요.', zh:'不用了，謝謝。', py:'Bú yòng le, xièxie.'},
 {cat:'기본 표현', kr:'잠시만요.', zh:'請等一下。', py:'Qǐng děng yíxià.'},
 {cat:'기본 표현', kr:'잘 모르겠어요.', zh:'我不知道。', py:'Wǒ bù zhīdào.'},
 {cat:'기본 표현', kr:'이거 얼마나 걸려요?', zh:'這個要多久？', py:'Zhège yào duōjiǔ?'},
 {cat:'기본 표현', kr:'다시 한 번 말씀해 주시겠어요?', zh:'可以再說一次嗎？', py:'Kěyǐ zài shuō yí cì ma?'},
 {cat:'길찾기 & 이동', kr:'화장실이 어디에 있나요?', zh:'請問洗手間在哪裡？', py:'Qǐngwèn xǐshǒujiān zài nǎlǐ?'},
 {cat:'길찾기 & 이동', kr:'~에 어떻게 가나요?', zh:'請問怎麼去～？', py:'Qǐngwèn zěnme qù~?'},
 {cat:'길찾기 & 이동', kr:'여기서 멀어요?', zh:'離這裡遠嗎？', py:'Lí zhèlǐ yuǎn ma?'},
 {cat:'길찾기 & 이동', kr:'걸어서 갈 수 있나요?', zh:'走路可以到嗎？', py:'Zǒulù kěyǐ dào ma?'},
 {cat:'길찾기 & 이동', kr:'MRT 역이 어디예요?', zh:'請問捷運站在哪裡？', py:'Qǐngwèn jiéyùn zhàn zài nǎlǐ?'},
 {cat:'길찾기 & 이동', kr:'이 버스가 ~에 가나요?', zh:'這班公車有到～嗎？', py:'Zhè bān gōngchē yǒu dào~ ma?'},
 {cat:'길찾기 & 이동', kr:'택시를 불러주실 수 있나요?', zh:'可以幫我叫計程車嗎？', py:'Kěyǐ bāng wǒ jiào jìchéngchē ma?'},
 {cat:'카페 & 식당', kr:'몇 분이세요? / 두 명입니다.', zh:'請問幾位？兩位。', py:'Qǐngwèn jǐ wèi? Liǎng wèi.'},
 {cat:'카페 & 식당', kr:'메뉴판 좀 주세요.', zh:'請給我菜單。', py:'Qǐng gěi wǒ càidān.'},
 {cat:'카페 & 식당', kr:'추천 메뉴가 있나요?', zh:'有推薦的菜嗎？', py:'Yǒu tuījiàn de cài ma?'},
 {cat:'카페 & 식당', kr:'이거 맵나요?', zh:'這個辣嗎？', py:'Zhège là ma?'},
 {cat:'카페 & 식당', kr:'덜 맵게 해주세요.', zh:'請不要太辣。', py:'Qǐng bú yào tài là.'},
 {cat:'카페 & 식당', kr:'물 좀 주세요.', zh:'請給我水。', py:'Qǐng gěi wǒ shuǐ.'},
 {cat:'카페 & 식당', kr:'이거 하나 주세요.', zh:'請給我一份這個。', py:'Qǐng gěi wǒ yí fèn zhège.'},
 {cat:'카페 & 식당', kr:'포장 되나요?', zh:'可以外帶嗎？', py:'Kěyǐ wàidài ma?'},
 {cat:'카페 & 식당', kr:'여기서 먹을게요.', zh:'內用。', py:'Nèiyòng.'},
 {cat:'카페 & 식당', kr:'포장해 주세요.', zh:'外帶，謝謝。', py:'Wàidài, xièxie.'},
 {cat:'카페 & 식당', kr:'정말 맛있어요!', zh:'很好吃！', py:'Hěn hǎochī!'},
 {cat:'카페 & 식당', kr:'와이파이 있나요?', zh:'有Wi-Fi嗎？', py:'Yǒu Wi-Fi ma?'},
 {cat:'쇼핑', kr:'이거 얼마예요?', zh:'這個多少錢？', py:'Zhège duōshǎo qián?'},
 {cat:'쇼핑', kr:'좀 더 싸게 해주실 수 있나요?', zh:'可以算便宜一點嗎？', py:'Kěyǐ suàn piányi yìdiǎn ma?'},
 {cat:'쇼핑', kr:'이거 마음에 들어요.', zh:'我喜歡這個。', py:'Wǒ xǐhuan zhège.'},
 {cat:'쇼핑', kr:'다른 색(사이즈) 있나요?', zh:'有其他顏色（尺寸）嗎？', py:'Yǒu qítā yánsè (chǐcùn) ma?'},
 {cat:'쇼핑', kr:'선물 포장해 주실 수 있나요?', zh:'可以幫我包裝成禮物嗎？', py:'Kěyǐ bāng wǒ bāozhuāng chéng lǐwù ma?'},
 {cat:'계산 & 결제', kr:'계산해 주세요.', zh:'買單，謝謝。', py:'Mǎidān, xièxie.'},
 {cat:'계산 & 결제', kr:'카드로 계산할게요.', zh:'我要刷卡。', py:'Wǒ yào shuākǎ.'},
 {cat:'계산 & 결제', kr:'현금으로 낼게요.', zh:'我付現金。', py:'Wǒ fù xiànjīn.'},
 {cat:'계산 & 결제', kr:'영수증 주세요.', zh:'請給我收據。', py:'Qǐng gěi wǒ shōujù.'},
 {cat:'계산 & 결제', kr:'이지카드로 결제할게요.', zh:'我用悠遊卡付款。', py:'Wǒ yòng yóuyóukǎ fùkuǎn.'},
 {cat:'도움 요청', kr:'도와주실 수 있나요?', zh:'可以幫我一下嗎？', py:'Kěyǐ bāng wǒ yíxià ma?'},
 {cat:'도움 요청', kr:'사진 좀 찍어주시겠어요?', zh:'可以幫我拍照嗎？', py:'Kěyǐ bāng wǒ pāizhào ma?'},
 {cat:'도움 요청', kr:'길을 잃었어요.', zh:'我迷路了。', py:'Wǒ mílù le.'},
 {cat:'도움 요청', kr:'몸이 안 좋아요. 병원에 가야 해요.', zh:'我不舒服，需要去醫院。', py:'Wǒ bù shūfu, xūyào qù yīyuàn.'},
 {cat:'생활 편의', kr:'여기 와이파이 되나요?', zh:'這裡有Wi-Fi嗎？', py:'Zhèlǐ yǒu Wi-Fi ma?'},
 {cat:'생활 편의', kr:'휴대폰 충전할 수 있는 곳 있나요?', zh:'哪裡可以充手機？', py:'Nǎlǐ kěyǐ chōng shǒujī?'},
 {cat:'생활 편의', kr:'편의점이 어디예요?', zh:'便利商店在哪裡？', py:'Biànlì shāngdiàn zài nǎlǐ?'},
];
const PHRASE_CATEGORY_ORDER = ['인사 & 자기소개','기본 표현','길찾기 & 이동','카페 & 식당','쇼핑','계산 & 결제','도움 요청','생활 편의'];

/* =====================================================================
   식당 도우미 — 가오슝(대만) 착석 → 주문 → 식사 → 계산 전과정 지원
===================================================================== */
const RESTAURANT_REGIONS = [
  {id:'khh', flag:'🇹🇼', label:'대만 (가오슝)', langCode:'zh-TW'},
];

const RESTAURANT_INTRO = {
  khh: [
    {kr:'안녕하세요. 저희는 두 명입니다. 자리가 있나요?', local:'你好，我們兩位，請問有位子嗎？'},
    {kr:'메뉴판 좀 부탁드립니다.', local:'請給我菜單。'},
    {kr:'혹시 추천해 주실 메뉴가 있나요?', local:'請問有推薦的菜嗎？'},
    {kr:'조금 이따가 다시 부를게요, 아직 고르는 중이에요.', local:'我們再看一下菜單，謝謝。'},
    {kr:'주문할게요.', local:'我們要點餐了。'},
    {kr:'덜 맵게 해주세요.', local:'請不要太辣。'},
    {kr:'화장실 어디 있어요?', local:'請問洗手間在哪裡？'},
    {kr:'와이파이 있나요?', local:'請問有Wi-Fi嗎？'},
    {kr:'현금만 받나요, 카드도 되나요?', local:'請問只能付現金，還是也可以刷卡？'},
  ],
};

// 가오슝 대표 야시장·로컬 음식(류허/루이펑 야시장, 치진 해산물 기준)
const RESTAURANT_FOOD = {
  khh: [
    {id:'niurou_mian', emoji:'🍜', kr:'우육면 (소고기 국수)', en:'BEEF NOODLE SOUP', local:'牛肉麵', desc:'대만 대표 소울푸드. 진하게 우린 소고기 육수에 쫄깃한 면.', price:'약 NT$150~220', recommend:'호텔 인근 로컬 면집'},
    {id:'a_gei', emoji:'🥟', kr:'아게이 (유부 조림 만두)', en:'A-GEI', local:'阿給', desc:'유부 안에 당면을 채우고 어묵풀로 봉해 찐 간식. 가오슝/탄수이 명물.', price:'약 NT$40~60', recommend:'류허 야시장'},
    {id:'oyster_omelet', emoji:'🦪', kr:'커자이젠 (굴전)', en:'OYSTER OMELET', local:'蚵仔煎', desc:'굴+계란+전분 반죽을 철판에 부친 대만식 전, 새콤달콤 소스 곁들임.', price:'약 NT$70~100', recommend:'류허/루이펑 야시장'},
    {id:'dachang_xiaochang', emoji:'🌭', kr:'따창바오샤오창 (대창 순대말이)', en:'TAIWANESE SAUSAGE WRAP', local:'大腸包小腸', desc:'찹쌀소시지(大腸) 안에 돼지고기 소시지(小腸)를 끼운 대만식 핫도그.', price:'약 NT$50~70', recommend:'루이펑 야시장'},
    {id:'yan_su_ji', emoji:'🍗', kr:'옌수지 (대만식 치킨)', en:'TAIWANESE POPCORN CHICKEN', local:'鹽酥雞', desc:'바질 잎과 함께 튀긴 짭짤한 치킨. 야시장 국민 야식.', price:'약 NT$70~120', recommend:'류허/루이펑 야시장'},
    {id:'seafood_congee', emoji:'🦐', kr:'하이시엔저우 (해산물 죽)', en:'SEAFOOD CONGEE', local:'海鮮粥', desc:'치진섬 명물, 신선한 해산물이 듬뿍 든 걸쭉한 죽.', price:'약 NT$150~250', recommend:'치진 해산물 거리'},
    {id:'guantsai_ban', emoji:'🍞', kr:'관차이반 (관재판)', en:'COFFIN BREAD', local:'棺材板', desc:'두꺼운 식빵을 튀겨 속을 파내고 크림소스+해물/고기를 채운 대만 남부 명물.', price:'약 NT$60~90', recommend:'류허 야시장'},
    {id:'doufa', emoji:'🍮', kr:'또우화 (두부 디저트)', en:'TOFU PUDDING', local:'豆花', desc:'부드러운 연두부에 땅콩·타로볼 등 토핑, 달콤한 시럽을 곁들인 디저트.', price:'약 NT$40~60', recommend:'류허/루이펑 야시장'},
  ],
};

const RESTAURANT_DRINK = {
  khh: [
    {id:'bubble_tea', emoji:'🧋', kr:'전주나이차 (버블티)', en:'BUBBLE MILK TEA', local:'珍珠奶茶', desc:'대만 발상지의 오리지널 버블 밀크티.', price:'약 NT$50~70'},
    {id:'papaya_milk', emoji:'🥛', kr:'무과우나이 (파파야 우유)', en:'PAPAYA MILK', local:'木瓜牛奶', desc:'가오슝 명물 음료, 진하고 달콤한 파파야+우유.', price:'약 NT$50~70'},
    {id:'winter_melon_tea', emoji:'🍵', kr:'동과차', en:'WINTER MELON TEA', local:'冬瓜茶', desc:'대만식 국민 음료, 은은한 단맛의 무알콜 차. 아이도 마시기 좋음.', price:'약 NT$30~50'},
    {id:'sugarcane_juice', emoji:'🥤', kr:'간자즈 (사탕수수 즙)', en:'SUGARCANE JUICE', local:'甘蔗汁', desc:'즉석 착즙 사탕수수 주스, 더운 날씨에 인기.', price:'약 NT$40~60'},
    {id:'taiwan_beer', emoji:'🍺', kr:'타이완 비어 (대만 맥주)', en:'TAIWAN BEER', local:'台灣啤酒', desc:'대만 대표 국민 맥주, 야시장 어디서나 판매.', price:'약 NT$40~70'},
    {id:'oolong_tea', emoji:'🍶', kr:'우롱차', en:'OOLONG TEA', local:'烏龍茶', desc:'대만 고산 우롱차, 편의점/찻집에서 쉽게 구매 가능.', price:'약 NT$25~45'},
  ],
};

// C. 기타 실전 회화(물/맛표현/포장/계산 등)
const RESTAURANT_ETC = {
  khh: [
    {cat:'맛 표현', kr:'맵지 않게 해주세요.', local:'請不要辣。'},
    {cat:'맛 표현', kr:'조금만 맵게 해주세요.', local:'請小辣就好。'},
    {cat:'맛 표현', kr:'고수 빼주세요.', local:'請不要加香菜。'},
    {cat:'맛 표현', kr:'정말 맛있어요!', local:'真的很好吃！'},
    {cat:'포장/식사방식', kr:'포장해 주세요.', local:'我要外帶，謝謝。'},
    {cat:'포장/식사방식', kr:'여기서 먹을게요.', local:'我要內用，謝謝。'},
    {cat:'포장/식사방식', kr:'봉투 하나 더 주시겠어요?', local:'可以再給我一個袋子嗎？'},
    {cat:'계산', kr:'전부 얼마예요?', local:'總共多少錢？'},
    {cat:'계산', kr:'카드 되나요?', local:'可以刷卡嗎？'},
    {cat:'계산', kr:'이지카드/아이패스로 될까요?', local:'可以用悠遊卡付款嗎？'},
    {cat:'계산', kr:'잔돈은 됐어요.', local:'不用找零了，謝謝。'},
  ],
};


/* =====================================================================
   STATE
===================================================================== */
const STATE_KEY = 'taiwan2026_state_v1';
function uid(p){ return p+'_'+Math.random().toString(36).slice(2,9); }
function esc(s){ return (s===null||s===undefined?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function loadJSON(key, fallback){ try{ const v = JSON.parse(localStorage.getItem(key)); return v==null? fallback : v; }catch(e){ return fallback; } }
function saveJSON(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

function defaultState(){
  return {
    days: SEED_DAYS.map((d,di)=>({ id:'day'+di, date:d.date, label:d.label, city:d.city, country:d.country, stay:d.stay, address:'', checkin:!!d.checkin,
      blocks: d.blocks.map(b=>({ id:uid('blk'), period:b.period, tag:b.tag, title:b.title, time:b.time, place:b.place, tip:b.tip, map:b.map, actCost:null, memo:'', status:'none', attachUrl:'', attachName:'', attachFileId:'' })) })),
    pool: SEED_POOL.map(p=>({ id:uid('pool'), city:p.city, title:p.title, desc:p.desc, map:p.map, attachUrl:'', attachName:'', attachFileId:'' })),
    shopping: SEED_SHOPPING.map(g=>({ id:uid('shop'), country:g.country, city:g.city, loc:g.loc||'', items:g.items.map(label=>({ id:uid('sitem'), label, note:'', checked:false })) })),
    checklist: SEED_CHECKLIST.map(c=>({ id:uid('cat'), cat:c.cat, items:c.items.map(label=>({ id:uid('item'), label, done:false, note:'' })) })),
    memos: [],
    restaurantOrder: { region:'khh', food:[], drink:[] },
    expenses: [], // 가계부: 카드 연결(blockId 有) 또는 미분류(blockId 無) 지출 레코드
    meta: { webhookUrl:'', lastSync:'', passport:{attachUrl:'',attachName:'',attachFileId:''}, insurance:{attachUrl:'',attachName:'',attachFileId:''}, medicine:{attachUrl:'',attachName:'',attachFileId:''}, expenseMigratedV1:false }
  };
}
let state = loadJSON(STATE_KEY, null) || defaultState();

/* ---- 마이그레이션: 기존에 저장된 데이터는 절대 지우지 않고, 없는 필드만 채워 넣습니다 ---- */
if(!state.shopping) state.shopping = defaultState().shopping;
if(!state.memos) state.memos = [];
if(!state.restaurantOrder) state.restaurantOrder = { region:'khh', food:[], drink:[] };
if(!state.restaurantOrder.food) state.restaurantOrder.food = [];
if(!state.restaurantOrder.drink) state.restaurantOrder.drink = [];
if(!state.restaurantOrder.region) state.restaurantOrder.region = 'khh';
if(!state.meta) state.meta = {};
if(state.meta.webhookUrl===undefined) state.meta.webhookUrl='';
if(state.meta.lastSync===undefined) state.meta.lastSync=null;
if(!state.meta.passport) state.meta.passport = {attachUrl:'', attachName:'', attachFileId:''};
if(!state.meta.insurance) state.meta.insurance = {attachUrl:'', attachName:'', attachFileId:''};
if(!state.meta.medicine) state.meta.medicine = {attachUrl:'', attachName:'', attachFileId:''};
[state.meta.passport, state.meta.insurance, state.meta.medicine].forEach(m=>{ if(m.attachFileId===undefined) m.attachFileId=''; });
if(state.meta.phraseLang===undefined) state.meta.phraseLang='zh';
PHRASES.forEach((p,i)=>{ p.id = i; });
if(!state.meta.webhookUrl && DEFAULT_WEBHOOK_URL) state.meta.webhookUrl = DEFAULT_WEBHOOK_URL;

state.days.forEach(d=>{
  if(d.address===undefined) d.address='';
  d.blocks.forEach(b=>{
    if(!b.status) b.status='none';
    if(b.attachUrl===undefined) b.attachUrl='';
    if(b.attachName===undefined) b.attachName='';
    if(b.attachFileId===undefined) b.attachFileId='';
    if(typeof b.actCost === 'number'){ b.actCost = b.actCost ? {currency:'TWD', amount:b.actCost} : null; } // 구버전(단일 숫자) 데이터 보존 이관
    if(b.actCost===undefined) b.actCost=null;
    delete b.estCost; // 예상비용 항목은 요청에 따라 제거(입력값이 있었다면 위에서 이미 실제비용으로 이관되지 않는 한 폐기됨을 안내)
  });
});
/* ---- 가계부(지출) 마이그레이션: 기존 카드별 actCost를 expenses 레코드로 1회만 이관 ---- */
if(!state.expenses) state.expenses = [];
if(state.meta.expenseMigratedV1 === undefined) state.meta.expenseMigratedV1 = false;
if(!state.meta.expenseMigratedV1){
  state.days.forEach(d=>{
    d.blocks.forEach(b=>{
      if(b.actCost && b.actCost.amount){
        state.expenses.push({
          id: uid('exp'), blockId: b.id, date: d.date, merchant: b.title||'', amount: Number(b.actCost.amount), currency: b.actCost.currency||'TWD', city: d.city||'',
          category: tagToCategory(b.tag), memo: '', driveUrl: '', source: 'migrated', createdAt: new Date().toISOString()
        });
      }
    });
  });
  state.meta.expenseMigratedV1 = true;
}
state.expenses.forEach(e=>{ // 필드 누락 보정
  if(e.blockId===undefined) e.blockId=null;
  if(e.category===undefined) e.category='기타';
  if(e.memo===undefined) e.memo='';
  if(e.city===undefined) e.city='';
  if(e.driveUrl===undefined) e.driveUrl='';
  if(e.source===undefined) e.source='manual';
});

state.pool.forEach(p=>{ if(p.attachUrl===undefined) p.attachUrl=''; if(p.attachName===undefined) p.attachName=''; if(p.attachFileId===undefined) p.attachFileId=''; });
state.checklist.forEach(cat=>{ cat.items.forEach(it=>{ if(it.note===undefined) it.note=''; }); });

// 쇼핑 리스트: 구버전은 items가 문자열 배열 + 별도 shopChecked 맵을 사용했음 → 항목 객체(id/note/checked)로 이관
if(state.shopping.length && typeof state.shopping[0].items[0] === 'string'){
  state.shopping = state.shopping.map((g,gi)=>({
    id: uid('shop'), country: g.country, city: g.city, loc: g.loc||'',
    items: g.items.map((label,ii)=>({ id:uid('sitem'), label, note:'', checked: !!(state.shopChecked && state.shopChecked[gi+'-'+ii]) }))
  }));
} else {
  state.shopping.forEach(g=>{
    if(!g.id) g.id = uid('shop');
    if(g.loc===undefined) g.loc='';
    g.items.forEach(it=>{ if(!it.id) it.id=uid('sitem'); if(it.note===undefined) it.note=''; if(it.checked===undefined) it.checked=false; });
  });
}
delete state.shopChecked;

function persist(){ saveJSON(STATE_KEY, state); }

let activeDayId = null;

/* =====================================================================
   NAV
===================================================================== */
const titles = {dashboard:'종합 대시보드', timeline:'인터랙티브 타임라인', checklist:'준비물 체크리스트', phrasebook:'여행 회화', restaurant:'식당 도우미', memo:'메모 & 쇼핑 가이드'};
function switchTab(name){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active', b.dataset.tab===name));
  document.getElementById('topTitle').textContent = titles[name];
  if(name==='timeline') renderTimeline();
  if(name==='dashboard') renderDashboard();
  if(name==='phrasebook') renderPhrasebook();
  if(name==='restaurant') renderRestaurant();
}

/* =====================================================================
   DASHBOARD
===================================================================== */
function daysBetween(a,b){ return Math.round((b-a)/86400000); }

function renderDashboard(){
  const todayStr = todayInTaipei();
  const today = new Date(todayStr+'T00:00:00Z');
  const start = new Date(state.days[0].date+'T00:00:00Z');
  const end = new Date(state.days[state.days.length-1].date+'T00:00:00Z');
  const totalDays = daysBetween(start,end)+1;
  let elapsed = daysBetween(start, today);
  let dday = daysBetween(today, start);

  const ddayText = document.getElementById('ddayText');
  const ddaySub = document.getElementById('ddaySub');
  const progressBar = document.getElementById('progressBar');
  const progressLabel = document.getElementById('progressLabel');
  let currentDay = null;

  if(dday > 0){
    ddayText.textContent = 'D-'+dday;
    ddaySub.textContent = '2026.09.17(목) 출발까지 (대만 현지시간 기준)';
    progressBar.style.width = '0%'; progressLabel.textContent = '0 / '+totalDays+' 일차';
  } else if(dday === 0){
    ddayText.textContent = 'D-DAY'; ddaySub.textContent = '오늘 출발! 좋은 여행 되세요 ✈️ (대만 현지시간 기준)';
    currentDay = state.days[0];
    progressBar.style.width = (100/totalDays)+'%'; progressLabel.textContent = '1 / '+totalDays+' 일차';
  } else if(elapsed >= 0 && elapsed < totalDays){
    const dayNum = elapsed+1;
    ddayText.textContent = dayNum+'일차'; ddaySub.textContent = '여정이 진행 중입니다 (대만 현지시간 기준)';
    currentDay = state.days[elapsed];
    progressBar.style.width = Math.round(dayNum/totalDays*100)+'%'; progressLabel.textContent = dayNum+' / '+totalDays+' 일차';
  } else {
    ddayText.textContent = 'END'; ddaySub.textContent = '2026년 여정이 마무리되었습니다';
    currentDay = state.days[state.days.length-1];
    progressBar.style.width = '100%'; progressLabel.textContent = totalDays+' / '+totalDays+' 일차';
  }

  const stayDay = currentDay || state.days[0];
  document.getElementById('stayCard').innerHTML = `
    <div style="display:flex; gap:12px; align-items:flex-start;">
      <div style="width:44px; height:44px; border-radius:11px; background:var(--paper-2); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
        <svg width="22" height="22" fill="none" stroke="var(--gold-deep)" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M5 21V7l8-4v18M13 21V11l6 4v6M9 9v.01M9 12v.01M9 15v.01"/></svg>
      </div>
      <div style="flex:1;">
        <div style="display:flex; align-items:center; gap:8px;">
          <div style="font-weight:700; font-size:15px;">${esc(stayDay.stay)}</div>
          <span class="icon-btn" onclick="openStayModal('${stayDay.id}')">✎</span>
        </div>
        <div style="font-size:12px; color:var(--muted); margin-top:2px;">${esc(stayDay.city)}, ${esc(stayDay.country)} · ${esc(stayDay.label)}</div>
        ${stayDay.address? `<div style="font-size:11.5px; color:var(--ink-2); margin-top:4px;">📍 ${esc(stayDay.address)}</div>` : `<div style="font-size:11px; color:var(--muted); margin-top:4px; font-style:italic;">주소 미입력 — ✎ 눌러서 예약 확인서의 정확한 주소를 추가해주세요</div>`}
      </div>
      <span class="badge ${stayDay.checkin?'badge-pending':'badge-done'}">${stayDay.checkin? '체크인 예정' : '투숙 중'}</span>
    </div>`;

  renderRouteLine(elapsed);
  renderBudget();
  renderSyncStatus();
}

function openStayModal(dayId){
  const day = state.days.find(d=>d.id===dayId);
  const html = `
    <div class="font-display" style="font-size:17px; font-weight:700; margin-bottom:6px;">숙소 정보 수정</div>
    <label>숙소명<input id="sm_name" value="${esc(day.stay)}"></label>
    <label>주소<textarea id="sm_addr" placeholder="예약 확인서의 정확한 주소를 입력해주세요">${esc(day.address||'')}</textarea></label>
    <div style="display:flex; gap:8px; margin-top:14px;">
      <button class="btn-primary" style="flex:1;" onclick="saveStayModal('${dayId}')">저장</button>
    </div>
    <button class="btn-cancel" onclick="closeFormModal()">취소</button>`;
  openFormModal(html);
}
function saveStayModal(dayId){
  const day = state.days.find(d=>d.id===dayId);
  const name = document.getElementById('sm_name').value.trim();
  day.stay = name || day.stay;
  day.address = document.getElementById('sm_addr').value.trim();
  persist(); closeFormModal(); renderDashboard();
}

/* =====================================================================
   가계부 (EXPENSES) — 카드 연결(blockId) 또는 미분류 지출
===================================================================== */
function expensesForBlock(blockId){ return state.expenses.filter(e=>e.blockId===blockId); }
function unassignedExpenses(){ return state.expenses.filter(e=>!e.blockId); }
function expenseKrw(e){ return Number(e.amount) * (FX[e.currency]||0); }
function sumKrw(list){ return list.reduce((s,e)=> s + expenseKrw(e), 0); }

function addOrUpdateExpense(expenseId, data){
  if(expenseId){
    const idx = state.expenses.findIndex(e=>e.id===expenseId);
    if(idx>-1) state.expenses[idx] = {...state.expenses[idx], ...data};
  } else {
    state.expenses.push({ id: uid('exp'), blockId:null, date:'', merchant:'', amount:0, currency:'TWD', category:'기타', memo:'', driveUrl:'', source:'manual', createdAt:new Date().toISOString(), ...data });
  }
  persist();
}
function deleteExpense(expenseId){
  state.expenses = state.expenses.filter(e=>e.id!==expenseId);
  persist();
}

function renderBudget(){
  const byCur = {TWD:0, KRW:0};
  let krwTotal = 0;
  const byCat = {};
  state.expenses.forEach(e=>{
    if(!e.amount) return;
    byCur[e.currency] = (byCur[e.currency]||0) + Number(e.amount);
    krwTotal += expenseKrw(e);
    byCat[e.category] = (byCat[e.category]||0) + expenseKrw(e);
  });
  document.getElementById('budgetAct').textContent = Math.round(krwTotal).toLocaleString()+'원';
  const parts = [];
  if(byCur.TWD) parts.push('TWD '+byCur.TWD.toLocaleString());
  if(byCur.KRW) parts.push('KRW '+byCur.KRW.toLocaleString());
  document.getElementById('budgetBreakdown').textContent = parts.length? parts.join(' · ') : '아직 등록된 지출이 없습니다';
  const catEl = document.getElementById('budgetCategoryBreakdown');
  if(catEl){
    const cats = EXPENSE_CATEGORIES.filter(c=>byCat[c]);
    catEl.innerHTML = cats.length ? cats.map(c=>`<div class="summary-row" style="display:flex; justify-content:space-between; font-size:12px; padding:3px 0;"><span>${CATEGORY_EMOJI[c]||''} ${esc(c)}</span><span class="font-mono">${Math.round(byCat[c]).toLocaleString()}원</span></div>`).join('') : '';
  }
  renderUnassignedExpenses();
}

function renderUnassignedExpenses(){
  const zone = document.getElementById('unassignedExpenseZone');
  if(!zone) return;
  const list = unassignedExpenses();
  const totalKrw = sumKrw(list);
  let html = `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
    <div style="font-size:11.5px; color:var(--muted);">📎 카드에 연결되지 않은 지출 ${list.length? '('+list.length+'건 · '+Math.round(totalKrw).toLocaleString()+'원)' : ''}</div>
    <div style="display:flex; gap:10px;">
      <span onclick="openReceiptCaptureModal(null)" style="font-size:11.5px; color:var(--brick); font-weight:700; cursor:pointer;">📷 촬영</span>
      <span onclick="openExpenseFormModal(null, null)" style="font-size:11.5px; color:var(--moss); font-weight:700; cursor:pointer;">＋ 지출 추가</span>
    </div>
  </div>`;
  if(list.length){
    html += list.slice().sort((a,b)=> (a.date<b.date?1:-1)).map(e=>`
      <div style="display:flex; justify-content:space-between; align-items:center; padding:7px 0; border-top:1px solid var(--line);">
        <div onclick="openExpenseFormModal(null, '${e.id}')" style="cursor:pointer;">
          <div style="font-size:12.5px; font-weight:700;">${CATEGORY_EMOJI[e.category]||''} ${esc(e.merchant||e.category)}</div>
          <div style="font-size:10.5px; color:var(--muted);">${esc(e.date||'')}${e.city?' · '+esc(e.city):''} · ${esc(e.category)}</div>
        </div>
        <div style="text-align:right;">
          <div class="font-mono" style="font-size:12px;">${Number(e.amount).toLocaleString()} ${esc(e.currency)}</div>
          <div style="font-size:10px; color:var(--muted);">≈ ${Math.round(expenseKrw(e)).toLocaleString()}원</div>
        </div>
      </div>`).join('');
  }
  zone.innerHTML = html;
}

/* 카드 연결 선택용 옵션 목록(날짜가 일치하는 날은 ⭐로 표시) */
function buildBlockLinkOptions(selectedBlockId, hintDate){
  let html = `<option value="">연결 안 함 (미분류)</option>`;
  state.days.forEach(d=>{
    const star = (hintDate && d.date===hintDate) ? '⭐ ' : '';
    html += `<optgroup label="${star}${esc(d.label)} · ${esc(d.city)}">`;
    d.blocks.forEach(b=>{
      html += `<option value="${b.id}" ${b.id===selectedBlockId?'selected':''}>${esc(b.period)} · ${esc(b.title)}</option>`;
    });
    html += `</optgroup>`;
  });
  return html;
}
function refreshBlockLinkSelect(){
  const sel = document.getElementById('em_blockLink');
  if(!sel) return;
  const dateVal = document.getElementById('em_date').value;
  sel.innerHTML = buildBlockLinkOptions(sel.value, dateVal);
}

/* --- 지출 등록/수정 모달 (카드 연결형 or 미분류) ---
   blockCtx: {dayId, blockId} 카드 안에서 연 경우(그 카드에 고정 연결) / null이면 미분류 지출(연결할 카드를 직접 선택 가능)
   prefill: OCR로 추출한 값으로 미리 채울 때 전달 { date, merchant, amount, currency, category, memo, city, driveUrl } */
function openExpenseFormModal(blockCtx, expenseId, prefill){
  const e = expenseId ? state.expenses.find(x=>x.id===expenseId) : null;
  const base = e || prefill || {};
  const data = {
    date: base.date || todayInTaipei(),
    merchant: base.merchant || '',
    amount: base.amount!==undefined? base.amount : '',
    currency: base.currency || 'TWD',
    category: base.category || (blockCtx? tagToCategory((state.days.find(d=>d.id===blockCtx.dayId).blocks.find(b=>b.id===blockCtx.blockId)||{}).tag) : '기타'),
    memo: base.memo || '',
    city: base.city || (blockCtx? state.days.find(d=>d.id===blockCtx.dayId).city : ''),
    driveUrl: base.driveUrl || '',
    blockId: e? e.blockId : (blockCtx? blockCtx.blockId : null)
  };
  const ctxJson = blockCtx ? `{dayId:'${blockCtx.dayId}',blockId:'${blockCtx.blockId}'}` : 'null';
  const html = `
    <div class="font-display" style="font-size:17px; font-weight:700; margin-bottom:6px;">${expenseId?'지출 수정':'지출 추가'}</div>
    ${data.driveUrl? `<div style="margin-bottom:8px;"><span onclick="window.open('${data.driveUrl.replace(/'/g,"\\'")}','_blank')" style="font-size:11.5px; color:var(--moss); font-weight:700; cursor:pointer;">🧾 촬영한 영수증 사진 보기</span></div>` : ''}
    <input type="hidden" id="em_driveUrl" value="${esc(data.driveUrl)}">
    <div class="formGrid">
      <label>날짜<input id="em_date" type="date" value="${esc(data.date||'')}" onchange="refreshBlockLinkSelect()"></label>
      <label>카테고리<select id="em_category">${EXPENSE_CATEGORIES.map(c=>`<option ${c===data.category?'selected':''}>${c}</option>`).join('')}</select></label>
    </div>
    <label>상점/내역<input id="em_merchant" value="${esc(data.merchant||'')}" placeholder="예: 85도씨 커피, MRT 교통카드 등"></label>
    <div class="formGrid">
      <label>금액<input id="em_amount" type="number" value="${esc(data.amount)}" placeholder="0" oninput="updateExpenseKrwPreview()"></label>
      <label>통화<select id="em_currency" onchange="updateExpenseKrwPreview()">
        <option value="TWD" ${data.currency==='TWD'?'selected':''}>TWD (대만달러)</option>
        <option value="KRW" ${data.currency==='KRW'?'selected':''}>KRW (원)</option>
      </select></label>
    </div>
    <div style="font-size:11.5px; color:var(--muted); margin:2px 0 6px;">환산비용(원): <span id="em_krwPreview" class="font-mono">${Math.round(Number(data.amount||0)*(FX[data.currency]||0)).toLocaleString()}원</span></div>
    <label>도시/국가<input id="em_city" value="${esc(data.city||'')}" placeholder="예: 가오슝"></label>
    <label>메모<textarea id="em_memo">${esc(data.memo||'')}</textarea></label>
    ${!blockCtx ? `<label>연결할 카드 (선택)<select id="em_blockLink">${buildBlockLinkOptions(data.blockId||'', data.date)}</select></label>` : ''}
    <div style="display:flex; gap:8px; margin-top:14px;">
      <button class="btn-primary" style="flex:1;" onclick="saveExpenseFormModal(${ctxJson}, ${expenseId?`'${expenseId}'`:null})">저장</button>
      ${expenseId? `<button class="btn-danger" onclick="deleteExpenseFromModal(${ctxJson}, '${expenseId}')">삭제</button>` : ''}
    </div>
    <button class="btn-cancel" onclick="${blockCtx? `openBlockModal('${blockCtx.dayId}','${blockCtx.blockId}')` : 'closeFormModal()'}">취소</button>`;
  openFormModal(html);
}
function updateExpenseKrwPreview(){
  const amt = Number(document.getElementById('em_amount').value)||0;
  const cur = document.getElementById('em_currency').value;
  document.getElementById('em_krwPreview').textContent = Math.round(amt*(FX[cur]||0)).toLocaleString()+'원';
}
function saveExpenseFormModal(blockCtx, expenseId){
  const val = id=>document.getElementById(id).value;
  const amt = val('em_amount').trim();
  const data = { date: val('em_date'), category: val('em_category'), merchant: val('em_merchant').trim(), amount: Number(amt)||0, currency: val('em_currency'), city: val('em_city').trim(), memo: val('em_memo').trim(), driveUrl: val('em_driveUrl') };
  const linkSel = document.getElementById('em_blockLink');
  data.blockId = blockCtx ? blockCtx.blockId : (linkSel? (linkSel.value || null) : null);
  addOrUpdateExpense(expenseId, data);
  closeFormModal();
  renderDashboard();
  if(activeDayId) renderTimelineBody();
  if(blockCtx){ openBlockModal(blockCtx.dayId, blockCtx.blockId); }
}
function deleteExpenseFromModal(blockCtx, expenseId){
  if(!confirm('이 지출 기록을 삭제할까요?')) return;
  deleteExpense(expenseId);
  renderDashboard();
  if(activeDayId) renderTimelineBody();
  if(blockCtx){ openBlockModal(blockCtx.dayId, blockCtx.blockId); } else { closeFormModal(); }
}
function renderBlockExpenseList(dayId, blockId){
  const list = expensesForBlock(blockId);
  if(!list.length) return `<div style="font-size:11.5px; color:var(--muted); margin-bottom:6px;">아직 연결된 지출이 없습니다.</div>`;
  return list.map(e=>`
    <div onclick="openExpenseFormModal({dayId:'${dayId}',blockId:'${blockId}'}, '${e.id}')" style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-top:1px solid var(--line); cursor:pointer;">
      <div>
        <div style="font-size:12px; font-weight:700;">${CATEGORY_EMOJI[e.category]||''} ${esc(e.merchant||e.category)}</div>
        <div style="font-size:10px; color:var(--muted);">${esc(e.date||'')}</div>
      </div>
      <div class="font-mono" style="font-size:12px;">${Number(e.amount).toLocaleString()} ${esc(e.currency)}</div>
    </div>`).join('');
}

/* 지출이 연결된 카드를 역으로 찾기(모든 날짜/카드를 검색) */
function findBlockContext(blockId){
  for(const d of state.days){
    const b = d.blocks.find(x=>x.id===blockId);
    if(b) return { dayId:d.id, blockId:b.id, blockTitle:b.title, dayLabel:d.label };
  }
  return null;
}

/* --- 전체 지출 목록 모달 (카드연결/미분류 구분 표시, 날짜별 그룹, 수정/삭제) --- */
function openExpenseListModal(){
  const list = state.expenses.slice().sort((a,b)=> (a.date<b.date?1: a.date>b.date?-1:0));
  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <div class="font-display" style="font-size:17px; font-weight:700;">전체 지출 목록 ${list.length? '('+list.length+'건)' : ''}</div>
      <button type="button" class="btn-ghost" style="font-size:11.5px; padding:6px 10px;" onclick="exportExpensesToExcel()">📊 엑셀로 내보내기</button>
    </div>`;
  if(!list.length){
    html += `<div style="font-size:12.5px; color:var(--muted); text-align:center; padding:20px 0;">아직 등록된 지출이 없습니다.</div>`;
  } else {
    let curDate = null;
    list.forEach(e=>{
      if(e.date !== curDate){
        html += `<div style="font-size:11px; color:var(--muted); font-family:'IBM Plex Mono',monospace; margin:14px 0 4px;">${esc(e.date||'날짜 미상')}</div>`;
        curDate = e.date;
      }
      const ctx = e.blockId ? findBlockContext(e.blockId) : null;
      const linkLabel = ctx ? `🔗 ${esc(ctx.blockTitle)}` : `📎 미분류`;
      const ctxJson = ctx ? `{dayId:'${ctx.dayId}',blockId:'${ctx.blockId}'}` : 'null';
      html += `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:8px 0; border-top:1px solid var(--line);">
          <div onclick="openExpenseFormModal(${ctxJson}, '${e.id}')" style="cursor:pointer; flex:1; padding-right:8px;">
            <div style="font-size:10.5px; color:var(--muted);">${CATEGORY_EMOJI[e.category]||''} ${esc(e.category)}${e.city?' · '+esc(e.city):''} · ${linkLabel}</div>
            <div style="font-size:13px; font-weight:700; margin-top:2px;">${esc(e.merchant||'(상점명 없음)')}</div>
            ${e.memo? `<div style="font-size:11px; color:var(--muted); margin-top:1px;">${esc(e.memo)}</div>` : ''}
          </div>
          <div style="text-align:right; flex-shrink:0;">
            <div class="font-mono" style="font-size:13px; font-weight:700;">${Number(e.amount).toLocaleString()} ${esc(e.currency)}</div>
            <div style="font-size:10px; color:var(--muted); margin-top:1px;">≈ ${Math.round(expenseKrw(e)).toLocaleString()}원</div>
            <div style="margin-top:4px;">
              <span class="icon-btn" onclick="event.stopPropagation(); openExpenseFormModal(${ctxJson}, '${e.id}')">✎</span>
              <span class="icon-btn danger" onclick="event.stopPropagation(); deleteExpenseFromListModal('${e.id}')">🗑</span>
            </div>
          </div>
        </div>`;
    });
  }
  html += `<button class="btn-cancel" style="margin-top:14px;" onclick="closeFormModal()">닫기</button>`;
  openFormModal(html);
}
const SOURCE_LABEL = { manual:'직접입력', migrated:'자동이관(구버전)', ocr:'영수증촬영' };

function exportExpensesToExcel(){
  if(typeof XLSX === 'undefined'){
    alert('엑셀 내보내기 기능을 불러오지 못했습니다.\nxlsx.full.min.js 파일이 app.js와 같은 폴더에 있는지 확인해주세요.');
    return;
  }
  const list = state.expenses.slice().sort((a,b)=> (a.date<b.date?-1: a.date>b.date?1:0));
  const header = ['날짜','카테고리','도시','상점명','금액','통화','원화환산(원)','연결된 일정카드','메모','등록방식'];
  const rows = list.map(e=>{
    const ctx = e.blockId ? findBlockContext(e.blockId) : null;
    return [
      e.date || '',
      e.category || '',
      e.city || '',
      e.merchant || '',
      Number(e.amount)||0,
      e.currency || '',
      Math.round(expenseKrw(e)),
      ctx ? ctx.blockTitle : '(미분류)',
      e.memo || '',
      SOURCE_LABEL[e.source] || e.source || ''
    ];
  });

  const totalKrw = list.reduce((sum,e)=> sum + expenseKrw(e), 0);
  const aoa = [header, ...rows, [], ['', '', '', '합계', '', '', Math.round(totalKrw), '', '', '']];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    {wch:11}, {wch:10}, {wch:10}, {wch:24}, {wch:10}, {wch:7}, {wch:13}, {wch:20}, {wch:24}, {wch:10}
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '지출목록');

  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  const fname = `TaiwanTrip2026_지출목록_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}.xlsx`;

  try{
    XLSX.writeFile(wb, fname);
  }catch(err){
    console.error(err);
    alert('엑셀 파일 생성 중 오류가 발생했습니다: ' + err.message);
  }
}

function exportChecklistToExcel(){
  if(typeof XLSX === 'undefined'){
    alert('엑셀 내보내기 기능을 불러오지 못했습니다.\nxlsx.full.min.js 파일이 app.js와 같은 폴더에 있는지 확인해주세요.');
    return;
  }
  const header = ['카테고리','항목','완료여부','비고'];
  const rows = [];
  state.checklist.forEach(cat=>{
    cat.items.forEach(item=>{
      rows.push([cat.cat || '', item.label || '', item.done ? '완료' : '대기', item.note || '']);
    });
  });

  const totalItems = rows.length;
  const totalDone = rows.filter(r=>r[2]==='완료').length;
  const aoa = [header, ...rows, [], ['합계', `${totalItems}개 항목`, `완료 ${totalDone} / 대기 ${totalItems-totalDone}`, '']];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [ {wch:16}, {wch:28}, {wch:10}, {wch:28} ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '준비물체크리스트');

  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  const fname = `TaiwanTrip2026_체크리스트_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}.xlsx`;

  try{
    XLSX.writeFile(wb, fname);
  }catch(err){
    console.error(err);
    alert('엑셀 파일 생성 중 오류가 발생했습니다: ' + err.message);
  }
}

function deleteExpenseFromListModal(expenseId){
  if(!confirm('이 지출 기록을 삭제할까요?')) return;
  deleteExpense(expenseId);
  renderDashboard();
  if(activeDayId) renderTimelineBody();
  openExpenseListModal(); // 목록 새로고침해서 같은 화면에 유지
}

/* =====================================================================
   영수증 촬영 → OCR (Claude Vision, Apps Script 경유)
===================================================================== */
let rc_pendingImageBase64 = null;
let rc_pendingImageMime = null;
let rc_rawDataUrl = null;
let rc_blockCtx = null;
let rc_dragMode = null, rc_startX=0, rc_startY=0, rc_startLeft=0, rc_startTop=0, rc_startW=0, rc_startH=0;
let rc_windowHandlersBound = false;

function openReceiptCaptureModal(blockCtx){
  rc_blockCtx = blockCtx;
  rc_pendingImageBase64 = null; rc_pendingImageMime = null; rc_rawDataUrl = null;
  const backTo = blockCtx ? `openExpenseFormModal({dayId:'${blockCtx.dayId}',blockId:'${blockCtx.blockId}'}, null)` : `openExpenseFormModal(null, null)`;
  const html = `
    <div class="font-display" style="font-size:17px; font-weight:700; margin-bottom:6px;">영수증 촬영</div>
    <div class="rc-capture-box" id="rc_captureBox">
      <div id="rc_initial">
        <div style="font-size:12.5px; color:var(--muted); text-align:center; padding:10px 0;">영수증을 촬영하거나 앨범에서 선택하세요</div>
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn-primary" style="flex:1;" onclick="document.getElementById('rc_cameraInput').click()">📷 카메라로 촬영</button>
          <button type="button" class="btn-ghost" style="flex:1;" onclick="document.getElementById('rc_galleryInput').click()">🖼 앨범에서 선택</button>
        </div>
        <input type="file" accept="image/*" capture="environment" id="rc_cameraInput" style="display:none;">
        <input type="file" accept="image/*" id="rc_galleryInput" style="display:none;">
      </div>
      <div id="rc_cropStage" style="display:none;">
        <div style="font-size:11.5px; color:var(--muted); margin:8px 0 6px;">모서리의 빨간 점을 드래그해 영수증 영역만 맞춰보세요</div>
        <div class="rc-crop-wrap" id="rc_cropWrap">
          <img id="rc_cropImg" alt="크롭할 영수증 사진">
          <div class="rc-crop-box" id="rc_cropBox"><div class="rc-crop-handle" id="rc_cropHandle"></div></div>
        </div>
        <div style="display:flex; gap:8px; margin-top:10px;">
          <button type="button" class="btn-primary" style="flex:1;" onclick="rcCropConfirm()">✂️ 이 영역만 사용</button>
          <button type="button" class="btn-ghost" style="flex:1;" onclick="rcCropSkip()">전체 사용</button>
        </div>
      </div>
      <div id="rc_previewStage" style="display:none;">
        <div class="rc-scan-wrap" id="rc_scanWrap">
          <img id="rc_previewImg" alt="분석할 영수증 사진">
          <div class="rc-scan-line" id="rc_scanLine" style="display:none;"></div>
        </div>
        <button type="button" class="btn-ghost" style="width:100%; margin-top:10px;" onclick="rcRetake()">↺ 다시 선택</button>
      </div>
    </div>
    <button class="btn-primary" style="width:100%; margin-top:10px;" id="rc_analyzeBtn" disabled onclick="rcAnalyze()">🤖 AI로 분석하기</button>
    <div id="rc_status" style="font-size:11.5px; color:var(--muted); margin-top:8px; text-align:center;"></div>
    <button class="btn-cancel" onclick="${backTo}">직접 입력할게요</button>`;
  openFormModal(html);
  rcBindHandlers();
}
function rcBindHandlers(){
  document.getElementById('rc_cameraInput').addEventListener('change', function(){ rcHandleFile(this.files[0]); });
  document.getElementById('rc_galleryInput').addEventListener('change', function(){ rcHandleFile(this.files[0]); });
  rcBindCropDrag();
}
function rcHandleFile(file){
  if(!file) return;
  rc_pendingImageMime = file.type || 'image/jpeg';
  const reader = new FileReader();
  reader.onload = function(){ rc_rawDataUrl = reader.result; rcOpenCropStage(rc_rawDataUrl); };
  reader.readAsDataURL(file);
}
function rcOpenCropStage(dataUrl){
  document.getElementById('rc_initial').style.display='none';
  document.getElementById('rc_previewStage').style.display='none';
  document.getElementById('rc_cropStage').style.display='block';
  const img = document.getElementById('rc_cropImg');
  img.onload = function(){
    const w = img.clientWidth, h = img.clientHeight;
    const boxW = w*0.8, boxH = h*0.8;
    const box = document.getElementById('rc_cropBox');
    box.style.left = ((w-boxW)/2)+'px';
    box.style.top = ((h-boxH)/2)+'px';
    box.style.width = boxW+'px';
    box.style.height = boxH+'px';
  };
  img.src = dataUrl;
}
function rcCropConfirm(){ rcFinishSelection(rcCropSelectedRegion()); }
function rcCropSkip(){ rcFinishSelection(rc_rawDataUrl); }
function rcFinishSelection(dataUrl){
  rc_pendingImageBase64 = dataUrl.split(',')[1];
  document.getElementById('rc_cropStage').style.display='none';
  document.getElementById('rc_previewStage').style.display='block';
  document.getElementById('rc_previewImg').src = dataUrl;
  document.getElementById('rc_analyzeBtn').disabled = false;
}
function rcRetake(){
  document.getElementById('rc_initial').style.display='block';
  document.getElementById('rc_cropStage').style.display='none';
  document.getElementById('rc_previewStage').style.display='none';
  document.getElementById('rc_analyzeBtn').disabled = true;
  document.getElementById('rc_cameraInput').value='';
  document.getElementById('rc_galleryInput').value='';
  rc_pendingImageBase64 = null; rc_rawDataUrl = null;
}
function rcCropSelectedRegion(){
  const img = document.getElementById('rc_cropImg');
  const box = document.getElementById('rc_cropBox');
  const scaleX = img.naturalWidth/img.clientWidth, scaleY = img.naturalHeight/img.clientHeight;
  const sx=(parseFloat(box.style.left)||0)*scaleX, sy=(parseFloat(box.style.top)||0)*scaleY;
  const sw=(parseFloat(box.style.width)||img.clientWidth)*scaleX, sh=(parseFloat(box.style.height)||img.clientHeight)*scaleY;
  const canvas=document.createElement('canvas'); canvas.width=sw; canvas.height=sh;
  canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL('image/jpeg',0.92);
}
function rcBindCropDrag(){
  const box = document.getElementById('rc_cropBox');
  const handle = document.getElementById('rc_cropHandle');
  box.addEventListener('mousedown', e=>{ if(e.target===box) rcPointerDown(e,'move'); });
  box.addEventListener('touchstart', e=>{ if(e.target===box) rcPointerDown(e,'move'); }, {passive:false});
  handle.addEventListener('mousedown', e=>rcPointerDown(e,'resize'));
  handle.addEventListener('touchstart', e=>rcPointerDown(e,'resize'), {passive:false});
  if(!rc_windowHandlersBound){
    window.addEventListener('mousemove', rcPointerMove);
    window.addEventListener('touchmove', rcPointerMove, {passive:false});
    window.addEventListener('mouseup', rcPointerUp);
    window.addEventListener('touchend', rcPointerUp);
    rc_windowHandlersBound = true;
  }
}
function rcPointerDown(e, m){
  e.preventDefault(); rc_dragMode=m;
  const box = document.getElementById('rc_cropBox');
  const p = rcGetPoint(e);
  rc_startX=p.x; rc_startY=p.y;
  rc_startLeft=parseFloat(box.style.left)||0; rc_startTop=parseFloat(box.style.top)||0;
  rc_startW=parseFloat(box.style.width)||0; rc_startH=parseFloat(box.style.height)||0;
}
function rcPointerMove(e){
  if(!rc_dragMode) return;
  const wrap = document.getElementById('rc_cropWrap'), box = document.getElementById('rc_cropBox');
  if(!wrap || !box) return; // 모달이 이미 닫힌 경우 방어
  e.preventDefault();
  const p = rcGetPoint(e);
  const dx = p.x-rc_startX, dy = p.y-rc_startY;
  const wrapW = wrap.clientWidth, wrapH = wrap.clientHeight;
  if(rc_dragMode==='move'){
    box.style.left = rcClamp(rc_startLeft+dx, 0, wrapW-rc_startW)+'px';
    box.style.top = rcClamp(rc_startTop+dy, 0, wrapH-rc_startH)+'px';
  } else {
    box.style.width = rcClamp(rc_startW+dx, 40, wrapW-rc_startLeft)+'px';
    box.style.height = rcClamp(rc_startH+dy, 40, wrapH-rc_startTop)+'px';
  }
}
function rcPointerUp(){ rc_dragMode=null; }
function rcGetPoint(e){ if(e.touches&&e.touches[0]) return {x:e.touches[0].clientX,y:e.touches[0].clientY}; return {x:e.clientX,y:e.clientY}; }
function rcClamp(v,min,max){ return Math.max(min,Math.min(max,v)); }
function rcSetScanning(on){
  const wrap = document.getElementById('rc_scanWrap'), line = document.getElementById('rc_scanLine');
  if(!wrap||!line) return;
  wrap.classList.toggle('rc-scanning', on);
  line.style.display = on? 'block':'none';
}
function rcAnalyze(){
  const statusEl = document.getElementById('rc_status');
  if(!state.meta.webhookUrl){ statusEl.textContent = '동기화 웹앱 URL이 설정되어 있지 않아 OCR을 사용할 수 없습니다.'; return; }
  if(!rc_pendingImageBase64) return;
  const btn = document.getElementById('rc_analyzeBtn');
  btn.disabled = true;
  statusEl.textContent = '🤖 영수증을 분석하는 중입니다…';
  rcSetScanning(true);
  fetch(state.meta.webhookUrl, {
    method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
    body: JSON.stringify({ action:'ocr', imageBase64: rc_pendingImageBase64, mimeType: rc_pendingImageMime })
  }).then(r=>r.json()).then(data=>{
    if(data.status !== 'ok') throw new Error(data.message||'분석 실패');
    const ex = data.extracted || {};
    openExpenseFormModal(rc_blockCtx, null, {
      date: ex.date || todayInTaipei(), merchant: ex.merchant || '', amount: (ex.amount!==null && ex.amount!==undefined)? ex.amount : '',
      currency: ex.currency || 'TWD', category: ex.category || '기타', city: ex.city || '', memo: ex.memo || '', driveUrl: ex.driveUrl || ''
    });
  }).catch(err=>{
    statusEl.textContent = '⚠️ 분석 실패: '+err.message+' (직접 입력해주세요)';
    btn.disabled = false;
    rcSetScanning(false);
  });
}

function renderRouteLine(elapsed){
  const svg = document.getElementById('routeSvg');
  const cities = [];
  state.days.forEach((d,i)=>{ if(cities.length===0 || cities[cities.length-1].city!==d.city) cities.push({city:d.city, idx:i}); });
  const stepW = 92, padX = 24, y = 54;
  const w = padX*2 + stepW*(cities.length-1) + 40;
  svg.setAttribute('width', w);
  svg.setAttribute('viewBox', `0 0 ${w} 108`);
  let html = `<line x1="${padX}" y1="${y}" x2="${padX+stepW*(cities.length-1)}" y2="${y}" stroke="#DED5C0" stroke-width="4"/>`;
  cities.forEach((c,i)=>{
    const x = padX + i*stepW;
    const isNow = elapsed!==null && elapsed>=0 && (c.idx<=elapsed && (i+1>=cities.length || cities[i+1].idx>elapsed));
    let fill = '#FBF8F1', stroke = '#C99A3E', r = 7;
    if(elapsed!==null && elapsed>=0){
      if(c.idx < elapsed){ fill = '#6C8A6F'; stroke='#4B6650'; }
      if(isNow){ fill = '#C99A3E'; stroke='#9C7325'; r=9; }
    }
    html += `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>`;
    html += `<text x="${x}" y="${y-16}" font-family="IBM Plex Mono, monospace" font-size="10" fill="#6B7280" text-anchor="middle">${esc(state.days[c.idx].label.replace(/\(.\)/,''))}</text>`;
    html += `<text x="${x}" y="${y+24}" font-family="Inter, sans-serif" font-size="11.5" font-weight="700" fill="${isNow?'#9C7325':'#1E2430'}" text-anchor="middle">${esc(c.city)}</text>`;
  });
  svg.innerHTML = html;
}

/* =====================================================================
   TIMELINE
===================================================================== */
function renderDayChips(){
  const wrap = document.getElementById('dayChips');
  const todayStr = todayInTaipei();
  wrap.innerHTML = state.days.map(d=>{
    const isToday = d.date===todayStr;
    return `<div class="daychip ${d.id===activeDayId?'active':''} ${isToday?'today':''}" onclick="selectDay('${d.id}')">
      <div class="d">${esc(d.label)}</div><div class="c">${esc(d.city)}</div>
    </div>`;
  }).join('');
}
function selectDay(id){ activeDayId = id; renderDayChips(); renderTimelineBody(); renderPool(); }
function renderTimeline(){
  if(!activeDayId){
    const todayStr = todayInTaipei();
    const found = state.days.find(d=>d.date>=todayStr);
    activeDayId = (found || state.days[0]).id;
  }
  renderDayChips(); renderTimelineBody(); renderPool();
}
function tagIcon(tag){ return {'이동':'🚌','관광':'📍','식사':'🍽️','숙소':'🏨','쇼핑':'🛍️'}[tag] || '•'; }
function statusMeta(status){
  if(status==='done') return {label:'✅ 완료', cls:'status-done'};
  if(status==='pass') return {label:'⏭ Pass', cls:'status-pass'};
  return {label:'○ 대기', cls:'status-none'};
}
function cycleStatus(dayId, blockId){
  const day = state.days.find(d=>d.id===dayId);
  const block = day.blocks.find(b=>b.id===blockId);
  const order = ['none','done','pass'];
  const idx = order.indexOf(block.status||'none');
  block.status = order[(idx+1)%order.length];
  persist();
  renderTimelineBody();
}

function renderTimelineBody(){
  const day = state.days.find(d=>d.id===activeDayId);
  const body = document.getElementById('timelineBody');
  body.innerHTML = `<div class="card" style="margin-bottom:12px;">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div class="font-display" style="font-size:17px; font-weight:700;">${esc(day.city)} <span style="font-weight:400; font-size:13px; color:var(--muted);">· ${esc(day.country)}</span></div>
        <div style="font-size:12px; color:var(--muted); margin-top:2px;">${esc(day.label)} · ${esc(day.stay)}</div>
      </div>
      <span style="font-size:10px; font-family:'IBM Plex Mono',monospace; color:var(--muted); text-align:right;">⠿ 눌러서<br>순서 변경</span>
    </div>
  </div>
  <div id="sortableContainer"></div>
  <button class="btn-primary" style="width:100%; margin-top:8px;" onclick="openBlockModal('${day.id}', null)">＋ 새 일정 카드 추가</button>`;

  const container = document.getElementById('sortableContainer');
  let currentPeriod = null, inner = '';
  day.blocks.forEach(b=>{
    if(b.period !== currentPeriod){ inner += `<div class="tl-period">${esc(b.period)}</div>`; currentPeriod = b.period; }
    let costRow = '';
    const bExpenses = expensesForBlock(b.id);
    if(bExpenses.length){
      const krw = Math.round(sumKrw(bExpenses));
      costRow = `<div style="margin-top:8px;"><span class="badge badge-done">🧾 지출 ${bExpenses.length}건 (≈ ${krw.toLocaleString()}원)</span></div>`;
    }
    const attachRow = b.attachUrl ? `<div style="margin-top:8px; display:flex; gap:14px; flex-wrap:wrap;">
      <span onclick="event.stopPropagation(); window.open('${b.attachUrl.replace(/'/g,"\\'")}','_blank')" style="font-size:11.5px; color:var(--moss); font-weight:700; cursor:pointer;">📄 첨부 PDF 보기${b.attachName?(' ('+esc(b.attachName)+')'):''}</span>
      <span onclick="event.stopPropagation(); window.open('${(b.attachFileId?('https://drive.google.com/uc?export=download&id='+b.attachFileId):b.attachUrl).replace(/'/g,"\\'")}','_blank')" style="font-size:11.5px; color:var(--gold-deep); font-weight:700; cursor:pointer;">⬇️ 다운로드</span>
    </div>` : '';
    const st = statusMeta(b.status);
    inner += `<div class="tl-card tag-${esc(b.tag)} ${st.cls}" data-id="${b.id}" onclick="openBlockModal('${day.id}','${b.id}')">
      <div class="tl-top">
        <div>
          <span class="drag-handle" onclick="event.stopPropagation();">⠿</span><span class="tl-time">${esc(b.time)}</span>
          <div class="tl-title">${tagIcon(b.tag)} ${esc(b.title)}</div>
          ${b.place?`<div class="tl-place">${esc(b.place)}</div>`:''}
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
          <span class="status-pill ${st.cls}" onclick="event.stopPropagation(); cycleStatus('${day.id}','${b.id}')">${st.label}</span>
          <span class="tl-tag-pill">${esc(b.tag)}</span>
          ${b.map?`<div class="tl-map-btn" onclick="event.stopPropagation(); openMap('${b.map.replace(/'/g,"\\'")}')"><svg fill="none" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg></div>`:''}
        </div>
      </div>
      ${b.tip?`<div class="tl-tip">💡 ${esc(b.tip)}</div>`:''}
      ${b.memo?`<div class="tl-tip" style="background:#EFEAF7;">📝 ${esc(b.memo)}</div>`:''}
      ${costRow}
      ${attachRow}
    </div>`;
  });
  container.innerHTML = inner;


  if(typeof Sortable !== 'undefined'){
    Sortable.create(container, {
      animation:180, handle:'.drag-handle', ghostClass:'sortable-ghost', dragClass:'sortable-drag',
      onEnd:function(){
        const newIds = Array.from(container.querySelectorAll('.tl-card')).map(el=>el.dataset.id);
        const map = {}; day.blocks.forEach(b=>map[b.id]=b);
        day.blocks = newIds.map(id=>map[id]);
        persist();
        renderTimelineBody();
      }
    });
  }
}

function renderPool(){
  const day = state.days.find(d=>d.id===activeDayId);
  const zone = document.getElementById('poolZone');
  const spots = state.pool.filter(p=>p.city===day.city);
  let html = spots.map(s=>`
    <div class="pool-card">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <div><b>${esc(s.title)}</b>${esc(s.desc)}</div>
        <div style="display:flex; gap:8px; flex-shrink:0;">
          <span class="icon-btn" onclick="openPoolModal('${s.id}')">✎</span>
          <span class="icon-btn danger" onclick="deletePoolSpot('${s.id}')">🗑</span>
        </div>
      </div>
      <div style="margin-top:7px; display:flex; gap:14px; align-items:center; flex-wrap:wrap;">
        ${s.map?`<span onclick="openMap('${s.map.replace(/'/g,"\\'")}')" style="font-size:11px; color:var(--brick); font-weight:700; cursor:pointer;">📍 지도 보기</span>`:''}
        ${s.attachUrl?`<span onclick="window.open('${s.attachUrl.replace(/'/g,"\\'")}','_blank')" style="font-size:11px; color:var(--moss); font-weight:700; cursor:pointer;">📄 첨부 PDF 보기</span><span onclick="window.open('${(s.attachFileId?('https://drive.google.com/uc?export=download&id='+s.attachFileId):s.attachUrl).replace(/'/g,"\\'")}','_blank')" style="font-size:11px; color:var(--gold-deep); font-weight:700; cursor:pointer;">⬇️ 다운로드</span>`:''}
        <span onclick="addPoolToTimeline('${s.id}')" style="font-size:11px; color:var(--moss); font-weight:700; cursor:pointer;">＋ 오늘 일정에 추가</span>
      </div>
    </div>`).join('');
  if(spots.length===0) html = `<div style="font-size:12.5px; color:var(--muted); text-align:center; padding:10px;">이 도시에 등록된 추천 스팟이 없습니다.</div>`;
  html += `<button class="btn-ghost" style="width:100%; margin-top:4px;" onclick="openPoolModal(null)">＋ 새 스팟 추가</button>`;
  zone.innerHTML = html;
}

function openMap(query){ window.open('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query), '_blank'); }
function jumpToSection(id){
  const el = document.getElementById(id);
  if(!el) return;
  const topbar = document.querySelector('.topbar');
  const offset = (topbar ? topbar.offsetHeight : 60) + 12;
  const y = el.getBoundingClientRect().top + window.pageYOffset - offset;
  window.scrollTo({top: Math.max(0,y), behavior:'smooth'});
}

/* --- Block create/edit modal --- */
function openBlockModal(dayId, blockId){
  const day = state.days.find(d=>d.id===dayId);
  const block = blockId ? day.blocks.find(b=>b.id===blockId) : {period: day.blocks.length? day.blocks[day.blocks.length-1].period : '오전', tag:'관광', title:'', time:'', place:'', tip:'', map:'', memo:'', status:'none'};
  const periods = ['아침','오전','오후','저녁','밤','추가 일정'];
  const tags = ['이동','관광','식사','숙소','쇼핑'];
  const poolOptions = state.pool.filter(p=>p.city===day.city);
  const html = `
    <div class="font-display" style="font-size:17px; font-weight:700; margin-bottom:6px;">${blockId?'일정 카드 수정':'새 일정 카드 추가'}</div>
    ${poolOptions.length? `<label>추천 스팟풀에서 불러오기 (선택)<select id="fm_poolpick" onchange="applyPoolPick(this.value)">
      <option value="">직접 입력</option>
      ${poolOptions.map(p=>`<option value="${p.id}">${esc(p.title)}</option>`).join('')}
    </select></label>` : ''}
    <div class="formGrid">
      <label>시간대<select id="fm_period">${periods.map(p=>`<option ${p===block.period?'selected':''}>${p}</option>`).join('')}</select></label>
      <label>태그<select id="fm_tag">${tags.map(t=>`<option ${t===block.tag?'selected':''}>${t}</option>`).join('')}</select></label>
    </div>
    <label>진행 상태<select id="fm_status">
      <option value="none" ${(!block.status||block.status==='none')?'selected':''}>○ 대기</option>
      <option value="done" ${block.status==='done'?'selected':''}>✅ 완료</option>
      <option value="pass" ${block.status==='pass'?'selected':''}>⏭ Pass(건너뜀)</option>
    </select></label>
    <label>제목<input id="fm_title" value="${esc(block.title)}" placeholder="예: 치진섬 투어"></label>
    <div class="formGrid">
      <label>시간<input id="fm_time" value="${esc(block.time)}" placeholder="09:00–13:00"></label>
      <label>장소<input id="fm_place" value="${esc(block.place)}" placeholder="장소명"></label>
    </div>
    <label>팁/설명<textarea id="fm_tip">${esc(block.tip)}</textarea></label>
    <label>구글맵 검색어<input id="fm_map" value="${esc(block.map)}" placeholder="영문 장소명 권장"></label>
    <label>첨부 PDF (예약확인서·티켓·메뉴판 등)</label>
    ${blockId ? `
      <div id="attach_display">${renderAttachDisplay(block, 'block', blockId)}</div>
      <input type="file" id="attach_input" accept="application/pdf" onchange="uploadAttachment('block','${blockId}', this)">
      <div id="attach_status" style="font-size:11px; color:var(--muted); margin:4px 0 8px;"></div>
    ` : `<div style="font-size:11.5px; color:var(--muted); margin-bottom:8px;">먼저 카드를 저장한 뒤, 다시 열어서 PDF를 첨부할 수 있어요.</div>`}
    <label>지출 (가계부)</label>
    ${blockId ? `
      <div id="fm_expenseList">${renderBlockExpenseList(dayId, blockId)}</div>
      <div style="display:flex; gap:14px; margin:8px 0;">
        <span onclick="openReceiptCaptureModal({dayId:'${dayId}',blockId:'${blockId}'})" style="font-size:11.5px; color:var(--brick); font-weight:700; cursor:pointer;">📷 촬영으로 추가</span>
        <span onclick="openExpenseFormModal({dayId:'${dayId}',blockId:'${blockId}'}, null)" style="font-size:11.5px; color:var(--moss); font-weight:700; cursor:pointer;">＋ 직접 입력</span>
      </div>
    ` : `<div style="font-size:11.5px; color:var(--muted); margin-bottom:8px;">먼저 카드를 저장한 뒤, 다시 열어서 지출을 연결할 수 있어요.</div>`}
    <label>현지 메모<textarea id="fm_memo">${esc(block.memo||'')}</textarea></label>
    <div style="display:flex; gap:8px; margin-top:14px;">
      <button class="btn-primary" style="flex:1;" onclick="saveBlockModal('${dayId}', ${blockId?`'${blockId}'`:null})">저장</button>
      ${blockId? `<button class="btn-ghost" onclick="demoteToPool('${dayId}','${blockId}')">풀로 내리기</button>` : ''}
      ${blockId? `<button class="btn-danger" onclick="deleteBlock('${dayId}','${blockId}')">삭제</button>` : ''}
    </div>
    <button class="btn-cancel" onclick="closeFormModal()">취소</button>`;
  openFormModal(html);
}
function applyPoolPick(poolId){
  if(!poolId) return;
  const spot = state.pool.find(p=>p.id===poolId);
  if(!spot) return;
  document.getElementById('fm_title').value = spot.title;
  document.getElementById('fm_place').value = spot.desc || '';
  document.getElementById('fm_map').value = spot.map || '';
}
function renderAttachDisplay(target, targetType, targetId){
  if(target.attachUrl){
    const downloadUrl = target.attachFileId ? `https://drive.google.com/uc?export=download&id=${target.attachFileId}` : target.attachUrl;
    return `<div style="display:flex; align-items:center; gap:10px; background:var(--paper-2); border-radius:9px; padding:9px 10px; margin-bottom:6px; flex-wrap:wrap;">
      <span style="font-size:12.5px; flex:1;">📄 ${esc(target.attachName||'첨부 파일')}</span>
      <span onclick="window.open('${target.attachUrl.replace(/'/g,"\\'")}','_blank')" style="font-size:11.5px; color:var(--moss); font-weight:700; cursor:pointer;">보기</span>
      <span onclick="window.open('${downloadUrl.replace(/'/g,"\\'")}','_blank')" style="font-size:11.5px; color:var(--gold-deep); font-weight:700; cursor:pointer;">⬇️ 다운로드</span>
      <span onclick="deleteAttachment('${targetType}','${targetId}')" style="font-size:11.5px; color:var(--brick); font-weight:700; cursor:pointer;">삭제</span>
    </div>
    <div style="font-size:10.5px; color:var(--muted); margin:-2px 0 6px;">💡 와이파이가 될 때 미리 "다운로드"를 눌러 기기에 저장해두면, 이후 인터넷이 없어도 다운로드 알림/파일 앱에서 열 수 있어요.</div>`;
  }
  return `<div style="font-size:11.5px; color:var(--muted); margin-bottom:6px;">등록된 파일이 없습니다.</div>`;
}
function findAttachTarget(targetType, targetId){
  if(targetType==='pool'){
    const spot = state.pool.find(p=>p.id===targetId);
    return spot ? {target:spot} : null;
  }
  if(targetType==='meta'){
    if(!state.meta[targetId]) state.meta[targetId] = {attachUrl:'', attachName:'', attachFileId:''};
    return {target: state.meta[targetId]};
  }
  for(const day of state.days){
    const block = day.blocks.find(b=>b.id===targetId);
    if(block) return {day, target:block};
  }
  return null;
}
function uploadAttachment(targetType, targetId, inputEl){
  const file = inputEl.files && inputEl.files[0];
  if(!file) return;
  const statusEl = document.getElementById('attach_status');
  if(file.type !== 'application/pdf' && !file.type.startsWith('image/')){ statusEl.textContent = 'PDF 또는 이미지 파일만 업로드할 수 있습니다.'; inputEl.value=''; return; }
  if(file.size > 8*1024*1024){ statusEl.textContent = '파일이 너무 큽니다 (8MB 이하로 올려주세요).'; inputEl.value=''; return; }
  if(!state.meta.webhookUrl){ statusEl.textContent = '먼저 대시보드에서 구글 시트 동기화 웹앱 URL을 설정해주세요.'; inputEl.value=''; return; }

  statusEl.textContent = '업로드 중… (파일 크기에 따라 몇 초 걸릴 수 있어요)';
  const reader = new FileReader();
  reader.onload = function(){
    const base64Data = reader.result.split(',')[1];
    fetch(state.meta.webhookUrl, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify({ action:'uploadFile', filename:file.name, mimeType:file.type, base64Data })
    }).then(r=>r.json()).then(res=>{
      if(res.status !== 'ok') throw new Error(res.message||'업로드 실패');
      const found = findAttachTarget(targetType, targetId);
      if(found){
        found.target.attachUrl = res.url;
        found.target.attachName = file.name;
        found.target.attachFileId = res.fileId || '';
        persist();
      }
      statusEl.textContent = '업로드 완료!';
      const displayEl = document.getElementById('attach_display');
      if(displayEl && found) displayEl.innerHTML = renderAttachDisplay(found.target, targetType, targetId);
      inputEl.value = '';
      if(targetType==='pool') renderPool(); else if(targetType==='block') renderTimelineBody();
    }).catch(err=>{
      statusEl.textContent = '업로드 실패: '+err.message+' (Apps Script에 구글드라이브 접근 권한이 승인되어 있는지 확인해주세요)';
    });
  };
  reader.readAsDataURL(file);
}
function deleteAttachment(targetType, targetId){
  if(!confirm('첨부된 PDF 연결을 삭제할까요? (구글 드라이브의 실제 파일은 남아있습니다)')) return;
  const found = findAttachTarget(targetType, targetId);
  if(!found) return;
  found.target.attachUrl = '';
  found.target.attachName = '';
  found.target.attachFileId = '';
  persist();
  const displayEl = document.getElementById('attach_display');
  if(displayEl) displayEl.innerHTML = renderAttachDisplay(found.target, targetType, targetId);
  if(targetType==='pool') renderPool(); else if(targetType==='block') renderTimelineBody();
}
function saveBlockModal(dayId, blockId){
  const day = state.days.find(d=>d.id===dayId);
  const val = id=>document.getElementById(id).value;
  const title = val('fm_title').trim();
  if(!title){ alert('제목을 입력해주세요.'); return; }
  const data = { period: val('fm_period'), tag: val('fm_tag'), title, time: val('fm_time').trim(), place: val('fm_place').trim(), tip: val('fm_tip').trim(), map: val('fm_map').trim(), memo: val('fm_memo').trim(), status: val('fm_status') };
  if(blockId){
    const idx = day.blocks.findIndex(b=>b.id===blockId);
    day.blocks[idx] = {...day.blocks[idx], ...data};
  } else {
    day.blocks.push({id:uid('blk'), ...data});
  }
  persist(); closeFormModal(); renderTimelineBody(); renderDashboard();
}
function deleteBlock(dayId, blockId){
  if(!confirm('이 일정 카드를 삭제할까요? (연결된 지출 기록은 "미분류 지출"로 보존됩니다)')) return;
  const day = state.days.find(d=>d.id===dayId);
  day.blocks = day.blocks.filter(b=>b.id!==blockId);
  state.expenses.forEach(e=>{ if(e.blockId===blockId) e.blockId=null; }); // 지출 기록은 삭제하지 않고 미분류로 보존
  persist(); closeFormModal(); renderTimelineBody(); renderDashboard();
}
function demoteToPool(dayId, blockId){
  const day = state.days.find(d=>d.id===dayId);
  const block = day.blocks.find(b=>b.id===blockId);
  if(!confirm('"'+block.title+'" 카드를 일정에서 빼고 추천 스팟 풀로 옮길까요?')) return;
  const cleanTitle = block.title.replace(/^📌\s*/,'').replace(/^★\s*/,'').trim();
  const existing = state.pool.find(p=>p.city===day.city && p.title.trim()===cleanTitle);
  if(existing){
    // 이미 같은 스팟이 풀에 있으면 중복 추가하지 않고, 비어있는 정보만 보완
    if(!existing.desc && (block.tip||block.place)) existing.desc = block.tip||block.place;
    if(!existing.map && block.map) existing.map = block.map;
    if(!existing.attachUrl && block.attachUrl){ existing.attachUrl = block.attachUrl; existing.attachName = block.attachName; existing.attachFileId = block.attachFileId||''; }
  } else {
    state.pool.push({id:uid('pool'), city:day.city, title:cleanTitle, desc: block.tip||block.place||'', map: block.map||'', attachUrl: block.attachUrl||'', attachName: block.attachName||'', attachFileId: block.attachFileId||''});
  }
  day.blocks = day.blocks.filter(b=>b.id!==blockId);
  state.expenses.forEach(e=>{ if(e.blockId===blockId) e.blockId=null; }); // 지출 기록은 삭제하지 않고 미분류로 보존(추후 다시 연결 가능)
  persist(); closeFormModal(); renderTimelineBody(); renderPool(); renderDashboard();
}

/* --- Pool create/edit modal --- */
function openPoolModal(poolId){
  const day = state.days.find(d=>d.id===activeDayId);
  const spot = poolId ? state.pool.find(p=>p.id===poolId) : {city: day.city, title:'', desc:'', map:''};
  const html = `
    <div class="font-display" style="font-size:17px; font-weight:700; margin-bottom:6px;">${poolId?'추천 스팟 수정':'새 추천 스팟 추가'}</div>
    <label>도시<input id="pm_city" value="${esc(spot.city)}" placeholder="예: 가오슝"></label>
    <label>이름<input id="pm_title" value="${esc(spot.title)}" placeholder="가게/장소 이름"></label>
    <label>설명<textarea id="pm_desc">${esc(spot.desc)}</textarea></label>
    <label>구글맵 검색어<input id="pm_map" value="${esc(spot.map)}" placeholder="영문 장소명 권장"></label>
    <label>첨부 PDF (메뉴판 등)</label>
    ${poolId ? `
      <div id="attach_display">${renderAttachDisplay(spot, 'pool', poolId)}</div>
      <input type="file" id="attach_input" accept="application/pdf" onchange="uploadAttachment('pool','${poolId}', this)">
      <div id="attach_status" style="font-size:11px; color:var(--muted); margin:4px 0 8px;"></div>
    ` : `<div style="font-size:11.5px; color:var(--muted); margin-bottom:8px;">먼저 스팟을 저장한 뒤, 다시 열어서 PDF를 첨부할 수 있어요.</div>`}
    <div style="display:flex; gap:8px; margin-top:14px;">
      <button class="btn-primary" style="flex:1;" onclick="savePoolModal(${poolId?`'${poolId}'`:null})">저장</button>
      ${poolId? `<button class="btn-danger" onclick="deletePoolSpot('${poolId}')">삭제</button>` : ''}
    </div>
    <button class="btn-cancel" onclick="closeFormModal()">취소</button>`;
  openFormModal(html);
}
function savePoolModal(poolId){
  const val = id=>document.getElementById(id).value.trim();
  const title = val('pm_title');
  if(!title){ alert('이름을 입력해주세요.'); return; }
  const data = {city: val('pm_city')||'미지정', title, desc: val('pm_desc'), map: val('pm_map')};
  if(poolId){
    const idx = state.pool.findIndex(p=>p.id===poolId);
    state.pool[idx] = {...state.pool[idx], ...data};
  } else {
    state.pool.push({id:uid('pool'), ...data});
  }
  persist(); closeFormModal(); renderPool();
}
function deletePoolSpot(poolId){
  if(!confirm('이 추천 스팟을 삭제할까요?')) return;
  state.pool = state.pool.filter(p=>p.id!==poolId);
  persist(); closeFormModal(); renderPool();
}
function addPoolToTimeline(poolId){
  const spot = state.pool.find(p=>p.id===poolId);
  const day = state.days.find(d=>d.id===activeDayId);
  day.blocks.push({id:uid('blk'), period:'추가 일정', tag:'관광', title:'📌 '+spot.title, time:'', place:spot.desc, tip:'추천 스팟 풀에서 추가됨', map:spot.map, actCost:null, memo:'', status:'none', attachUrl:spot.attachUrl||'', attachName:spot.attachName||'', attachFileId:spot.attachFileId||''});
  persist(); renderTimelineBody();
}

/* =====================================================================
   CHECKLIST
===================================================================== */
function renderChecklist(){
  const body = document.getElementById('checklistBody');
  let totalItems=0, totalDone=0, html='';
  html += `<div class="card jump-card">
    <span class="jump-label">📍 바로가기</span>
    <select class="jump-select" onchange="if(this.value) jumpToSection(this.value); this.value='';">
      <option value="">카테고리 선택…</option>
      ${state.checklist.map(cat=>`<option value="cat-${cat.id}">${esc(cat.cat)}</option>`).join('')}
    </select>
  </div>
  <div class="card" style="display:flex; justify-content:flex-end;">
    <button type="button" class="btn-ghost" style="font-size:11.5px; padding:6px 10px;" onclick="exportChecklistToExcel()">📊 엑셀로 내보내기</button>
  </div>`;
  state.checklist.forEach(cat=>{
    const done = cat.items.filter(i=>i.done).length;
    totalItems += cat.items.length; totalDone += done;
    html += `<div class="card chk-cat" id="cat-${cat.id}">
      <div class="chk-cat-head">
        <h3>${esc(cat.cat)}</h3>
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="chk-progress">${done}/${cat.items.length}</span>
          <span class="icon-btn" onclick="editCatName('${cat.id}')">✎</span>
          <span class="icon-btn danger" onclick="deleteCategory('${cat.id}')">🗑</span>
        </div>
      </div>
      ${cat.items.map(item=>`
        <div class="chk-item-wrap">
          <div class="chk-item">
            <div class="chk-box ${item.done?'on':''}" onclick="toggleChk('${cat.id}','${item.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
            </div>
            <div class="chk-label ${item.done?'done':''}">${esc(item.label)}</div>
            <span class="icon-btn" onclick="editChkItem('${cat.id}','${item.id}')">✎</span>
            <span class="icon-btn danger" onclick="deleteChkItem('${cat.id}','${item.id}')">×</span>
          </div>
          <input class="chk-note-input" value="${esc(item.note||'')}" placeholder="비고 (선택)" oninput="updateChkNote('${cat.id}','${item.id}', this.value); flashSaved(this)">
        </div>`).join('')}
      <div style="display:flex; gap:6px; margin-top:9px;">
        <input id="newitem-${cat.id}" placeholder="새 항목 추가" style="flex:1; border:1px solid var(--line); border-radius:8px; padding:7px 9px; font-size:12.5px;" onkeydown="if(event.key==='Enter')addChecklistItem('${cat.id}')">
        <button class="btn-ghost" onclick="addChecklistItem('${cat.id}')">추가</button>
      </div>
    </div>`;
  });
  html += `<div class="card">
    <div style="display:flex; gap:6px;">
      <input id="newCatInput" placeholder="새 카테고리 이름" style="flex:1; border:1px solid var(--line); border-radius:8px; padding:9px 10px; font-size:13px;" onkeydown="if(event.key==='Enter')addCategory()">
      <button class="btn-primary" onclick="addCategory()">카테고리 추가</button>
    </div>
  </div>`;
  body.innerHTML = html;
  const pct = totalItems? Math.round(totalDone/totalItems*100) : 0;
  document.getElementById('chkOverallPct').textContent = pct+'%';
  document.getElementById('chkOverallBar').style.width = pct+'%';
}
function flashSaved(el){
  el.style.borderBottomColor = '#4B6650';
  clearTimeout(el._flashTimer);
  el._flashTimer = setTimeout(()=>{ el.style.borderBottomColor = ''; }, 500);
}
function toggleChk(catId, itemId){
  const cat = state.checklist.find(c=>c.id===catId);
  const item = cat.items.find(i=>i.id===itemId);
  item.done = !item.done; persist(); renderChecklist();
}
function editChkItem(catId, itemId){
  const cat = state.checklist.find(c=>c.id===catId);
  const item = cat.items.find(i=>i.id===itemId);
  const val = prompt('항목 이름 수정', item.label);
  if(val===null || !val.trim()) return;
  item.label = val.trim(); persist(); renderChecklist();
}
function deleteChkItem(catId, itemId){
  if(!confirm('이 항목을 삭제할까요?')) return;
  const cat = state.checklist.find(c=>c.id===catId);
  cat.items = cat.items.filter(i=>i.id!==itemId); persist(); renderChecklist();
}
function addChecklistItem(catId){
  const input = document.getElementById('newitem-'+catId);
  const val = input.value.trim(); if(!val) return;
  const cat = state.checklist.find(c=>c.id===catId);
  cat.items.push({id:uid('item'), label:val, done:false, note:''});
  input.value=''; persist(); renderChecklist();
}
function updateChkNote(catId, itemId, val){
  const cat = state.checklist.find(c=>c.id===catId);
  const item = cat.items.find(i=>i.id===itemId);
  item.note = val; persist();
}
function editCatName(catId){
  const cat = state.checklist.find(c=>c.id===catId);
  const val = prompt('카테고리 이름 수정', cat.cat);
  if(val===null || !val.trim()) return;
  cat.cat = val.trim(); persist(); renderChecklist();
}
function deleteCategory(catId){
  if(!confirm('이 카테고리 전체를 삭제할까요?')) return;
  state.checklist = state.checklist.filter(c=>c.id!==catId); persist(); renderChecklist();
}
function addCategory(){
  const input = document.getElementById('newCatInput');
  const val = input.value.trim(); if(!val) return;
  state.checklist.push({id:uid('cat'), cat:val, items:[]});
  input.value=''; persist(); renderChecklist();
}

/* =====================================================================
   여행 회화 (중국어 · 대만)
===================================================================== */
function renderPhrasebook(){
  const wrap = document.getElementById('phraseBody');
  const grouped = {};
  PHRASES.forEach(p=>{ if(!grouped[p.cat]) grouped[p.cat]=[]; grouped[p.cat].push(p); });

  let html = `<div class="card jump-card">
    <span class="jump-label">📍 바로가기</span>
    <select class="jump-select" onchange="if(this.value) jumpToSection(this.value); this.value='';">
      <option value="">상황 선택…</option>
      ${PHRASE_CATEGORY_ORDER.map((cat,i)=>`<option value="phrase-cat-${i}">${esc(cat)}</option>`).join('')}
    </select>
  </div>
  <div class="card" style="padding:12px 14px; text-align:center; font-size:13px; font-weight:700; color:var(--ink-2);">🇹🇼 중국어(표준어) · 대만</div>`;

  PHRASE_CATEGORY_ORDER.forEach((cat,ci)=>{
    const items = grouped[cat];
    if(!items || !items.length) return;
    html += `<div class="card" id="phrase-cat-${ci}">
      <div class="section-label">${esc(cat)}</div>
      ${items.map(p=>`<div class="phrase-row" onclick="openPhraseModal(${p.id})">
        <div>
          <div class="phrase-kr">${esc(p.kr)}</div>
          <div class="phrase-foreign">${esc(p.zh)} · ${esc(p.py)}</div>
        </div>
        <span class="phrase-arrow">🔊</span>
      </div>`).join('')}
    </div>`;
  });
  wrap.innerHTML = html;
}
function openPhraseModal(id){
  const p = PHRASES.find(x=>x.id===id);
  const langCode = 'zh-TW';
  const html = `
    <div class="font-mono" style="font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--gold-deep); font-weight:700; margin-bottom:8px;">중국어(표준어)</div>
    <div class="font-display" style="font-size:23px; font-weight:700; line-height:1.4; margin-bottom:6px;">${esc(p.zh)}</div>
    <div class="font-mono" style="font-size:13px; color:var(--gold-deep); margin-bottom:12px;">${esc(p.py)}</div>
    <div style="font-size:14px; color:var(--ink-2); margin-bottom:20px;">${esc(p.kr)}</div>
    <button class="btn-primary" style="width:100%; font-size:15px; padding:13px;" onclick="speakPhrase('${p.zh.replace(/'/g,"\\'")}','${langCode}')">🔊 발음 듣기</button>
    <button class="btn-cancel" onclick="closeFormModal()">닫기</button>`;
  openFormModal(html);
}
function speakPhrase(text, langCode){
  if(!('speechSynthesis' in window)){ alert('이 기기/브라우저는 음성 재생을 지원하지 않습니다.'); return; }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = langCode;
  utter.rate = 0.88;
  window.speechSynthesis.speak(utter);
}

/* =====================================================================
   식당 도우미
===================================================================== */
function speakLocal(text, langCode){
  if(!('speechSynthesis' in window)){ alert('이 기기/브라우저는 음성 재생을 지원하지 않습니다.'); return; }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = langCode;
  utter.rate = 0.88;
  window.speechSynthesis.speak(utter);
}
function openLocalPhraseModal(kr, local, langCode){
  const html = `
    <div class="font-mono" style="font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--gold-deep); font-weight:700; margin-bottom:8px;">현지어</div>
    <div class="font-display" style="font-size:22px; font-weight:700; line-height:1.4; margin-bottom:12px;">${esc(local)}</div>
    <div style="font-size:14px; color:var(--ink-2); margin-bottom:20px;">${esc(kr)}</div>
    <button class="btn-primary" style="width:100%; font-size:15px; padding:13px;" onclick="speakLocal('${local.replace(/'/g,"\\'")}','${langCode}')">🔊 발음 듣기</button>
    <button class="btn-cancel" onclick="closeFormModal()">닫기</button>`;
  openFormModal(html);
}

function currentRestaurantRegion(){
  return RESTAURANT_REGIONS.find(r=>r.id===state.restaurantOrder.region) || RESTAURANT_REGIONS[0];
}
function changeRestaurantRegion(id){
  if(state.restaurantOrder.region !== id){
    // 지역이 바뀌면 이전 지역 메뉴 id가 새 지역에 없을 수 있어 주문 목록을 초기화
    state.restaurantOrder.food = [];
    state.restaurantOrder.drink = [];
  }
  state.restaurantOrder.region = id;
  persist();
  renderRestaurant();
}

function renderRestaurant(){
  const region = currentRestaurantRegion();
  const wrap = document.getElementById('restaurantBody');
  const intro = RESTAURANT_INTRO[region.id] || [];
  const etc = RESTAURANT_ETC[region.id] || [];

  let html = `<div class="card jump-card">
    <span class="jump-label">📍 바로가기</span>
    <select class="jump-select" onchange="if(this.value) jumpToSection(this.value); this.value='';">
      <option value="">섹션 선택…</option>
      <option value="rest-intro">A. 인트로 대화</option>
      <option value="rest-food">B. 음식 주문</option>
      <option value="rest-drink">B. 음료 주문</option>
      <option value="rest-etc">C. 기타 실전 회화</option>
    </select>
  </div>`;

  if(RESTAURANT_REGIONS.length > 1){
    html += `<div class="card">
      <div class="section-label">지역 선택</div>
      <select class="jump-select" style="background:var(--white);" onchange="changeRestaurantRegion(this.value)">
        ${RESTAURANT_REGIONS.map(r=>`<option value="${r.id}" ${r.id===region.id?'selected':''}>${r.flag} ${esc(r.label)}</option>`).join('')}
      </select>
    </div>`;
  } else {
    html += `<div class="card" style="padding:12px 14px; text-align:center; font-size:13px; font-weight:700; color:var(--ink-2);">${region.flag} ${esc(region.label)}</div>`;
  }

  html += `<div class="card" id="rest-intro">
    <div class="section-label">A. 인트로 대화 (착석)</div>
    ${intro.map(p=>`<div class="phrase-row" onclick="openLocalPhraseModal('${p.kr.replace(/'/g,"\\'")}','${p.local.replace(/'/g,"\\'")}','${region.langCode}')">
      <div>
        <div class="phrase-kr">${esc(p.kr)}</div>
        <div class="phrase-foreign">${esc(p.local)}</div>
      </div>
      <span class="phrase-arrow">🔊</span>
    </div>`).join('')}
  </div>`;

  html += renderOrderBuilder(region, 'food', '🍽️ B. 음식 주문');
  html += renderOrderBuilder(region, 'drink', '🥤 B. 음료 주문');

  html += `<div class="card" id="rest-etc">
    <div class="section-label">C. 기타 실전 회화</div>
    ${groupEtcByCategory(etc)}
  </div>`;

  wrap.innerHTML = html;
  updateOrderPreview('food');
  updateOrderPreview('drink');
}

function groupEtcByCategory(etc){
  const grouped = {};
  const order = [];
  etc.forEach(p=>{ if(!grouped[p.cat]){ grouped[p.cat]=[]; order.push(p.cat); } grouped[p.cat].push(p); });
  const region = currentRestaurantRegion();
  return order.map(cat=>`
    <div style="font-size:11.5px; font-weight:700; color:var(--moss); margin:12px 0 4px;">${esc(cat)}</div>
    ${grouped[cat].map(p=>`<div class="phrase-row" onclick="openLocalPhraseModal('${p.kr.replace(/'/g,"\\'")}','${p.local.replace(/'/g,"\\'")}','${region.langCode}')">
      <div>
        <div class="phrase-kr">${esc(p.kr)}</div>
        <div class="phrase-foreign">${esc(p.local)}</div>
      </div>
      <span class="phrase-arrow">🔊</span>
    </div>`).join('')}
  `).join('');
}

function renderOrderBuilder(region, kind, title){
  const menu = (kind==='food' ? RESTAURANT_FOOD : RESTAURANT_DRINK)[region.id] || [];
  const orderList = state.restaurantOrder[kind];
  const sectionId = 'rest-'+kind;
  return `<div class="card" id="${sectionId}">
    <div class="section-label">${title}</div>
    <select id="${kind}Select" class="jump-select" style="background:var(--white); margin-bottom:10px;" onchange="updateOrderPreview('${kind}')">
      ${menu.map(m=>`<option value="${m.id}">${esc(m.kr)}</option>`).join('')}
    </select>
    <div id="${kind}Preview"></div>
    <div style="display:flex; align-items:center; gap:10px; margin:12px 0;">
      <span style="font-size:12.5px; color:var(--muted); font-weight:600;">수량</span>
      <button class="qty-btn" onclick="stepQty('${kind}',-1)">−</button>
      <span id="${kind}QtyVal" class="font-mono" style="font-size:16px; font-weight:700; min-width:24px; text-align:center;">1</span>
      <button class="qty-btn" onclick="stepQty('${kind}',1)">＋</button>
      <button class="btn-primary" style="flex:1; margin-left:8px;" onclick="addToOrder('${kind}')">주문 목록에 추가</button>
    </div>
    <div id="${kind}OrderList">${renderOrderListHtml(kind, orderList, menu)}</div>
    ${orderList.length ? `
    <button class="btn-primary" style="width:100%; margin-top:10px; background:var(--moss);" onclick="buildOrderPhrase('${kind}')">📋 이 주문 문구 만들기</button>
    <div id="${kind}PhraseResult"></div>
    <button class="btn-ghost" style="width:100%; margin-top:8px;" onclick="clearOrder('${kind}')">주문 목록 초기화</button>
    ` : ''}
  </div>`;
}
function renderOrderListHtml(kind, orderList, menu){
  if(!orderList.length) return `<div style="font-size:12px; color:var(--muted); padding:6px 2px;">아직 담은 항목이 없습니다.</div>`;
  return orderList.map((o,i)=>{
    const item = menu.find(m=>m.id===o.itemId);
    if(!item) return '';
    return `<div class="phrase-row" style="cursor:default;">
      <div><div class="phrase-kr">${item.emoji} ${esc(item.kr)}</div><div class="phrase-foreign">${esc(item.local)}</div></div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="font-mono" style="font-size:13px; font-weight:700;">×${o.qty}</span>
        <span class="icon-btn danger" onclick="removeOrderItem('${kind}',${i})">✕</span>
      </div>
    </div>`;
  }).join('');
}

let qtyState = { food:1, drink:1 };
function stepQty(kind, delta){
  qtyState[kind] = Math.max(1, (qtyState[kind]||1) + delta);
  document.getElementById(kind+'QtyVal').textContent = qtyState[kind];
}
function updateOrderPreview(kind){
  const region = currentRestaurantRegion();
  const menu = (kind==='food' ? RESTAURANT_FOOD : RESTAURANT_DRINK)[region.id] || [];
  const select = document.getElementById(kind+'Select');
  if(!select) return;
  const item = menu.find(m=>m.id===select.value) || menu[0];
  const preview = document.getElementById(kind+'Preview');
  if(!item || !preview) return;
  preview.innerHTML = `<div style="display:flex; gap:12px; align-items:flex-start; background:var(--paper-2); border-radius:10px; padding:12px;">
    <div style="font-size:32px; line-height:1;">${item.emoji}</div>
    <div style="flex:1;">
      <div style="font-weight:700; font-size:14px;">${esc(item.kr)}</div>
      <div style="font-size:12px; color:var(--gold-deep); font-weight:600; margin-top:1px;">${esc(item.en)} · <span class="font-mono">${esc(item.local)}</span></div>
      <div style="font-size:12px; color:var(--ink-2); margin-top:5px; line-height:1.5;">${esc(item.desc)}</div>
      <div style="font-size:11.5px; color:var(--muted); margin-top:5px;">${item.price?('가격대 '+esc(item.price)):''}${item.recommend?(' · 추천 '+esc(item.recommend)):''}</div>
    </div>
  </div>`;
}
function addToOrder(kind){
  const region = currentRestaurantRegion();
  const menu = (kind==='food' ? RESTAURANT_FOOD : RESTAURANT_DRINK)[region.id] || [];
  const select = document.getElementById(kind+'Select');
  const itemId = select.value;
  const qty = qtyState[kind]||1;
  const list = state.restaurantOrder[kind];
  const existing = list.find(o=>o.itemId===itemId);
  if(existing) existing.qty += qty; else list.push({itemId, qty});
  qtyState[kind] = 1;
  persist();
  renderRestaurant();
}
function removeOrderItem(kind, idx){
  state.restaurantOrder[kind].splice(idx,1);
  persist();
  renderRestaurant();
}
function clearOrder(kind){
  if(!confirm('주문 목록을 초기화할까요?')) return;
  state.restaurantOrder[kind] = [];
  persist();
  renderRestaurant();
}
const ORDER_PHRASE_TEMPLATE = {
  khh: {start:'我要點：', end:'，謝謝。'},
};

function buildOrderPhrase(kind){
  const region = currentRestaurantRegion();
  const menu = (kind==='food' ? RESTAURANT_FOOD : RESTAURANT_DRINK)[region.id] || [];
  const list = state.restaurantOrder[kind];
  if(!list.length) return;
  const parts = list.map(o=>{
    const item = menu.find(m=>m.id===o.itemId);
    return item ? `${item.local} ×${o.qty}` : null;
  }).filter(Boolean);
  if(!parts.length){
    alert('주문 항목을 찾을 수 없습니다. 지역을 바꾸신 경우 주문 목록을 다시 담아주세요.');
    return;
  }
  const tmpl = ORDER_PHRASE_TEMPLATE[region.id] || ORDER_PHRASE_TEMPLATE.khh;
  const phrase = `${tmpl.start}${parts.join('、')}${tmpl.end}`;
  const resultEl = document.getElementById(kind+'PhraseResult');
  if(!resultEl) return;
  resultEl.innerHTML = `
    <div style="background:var(--paper-2); border-radius:10px; padding:12px; margin-top:10px;">
      <div class="font-display" style="font-size:16px; font-weight:700; line-height:1.5; margin-bottom:8px;">${esc(phrase)}</div>
      <div style="font-size:11px; color:var(--muted); margin-bottom:10px;">※ 수량에 따른 어미 변화는 반영되지 않았지만, 현지에서 화면을 보여주며 말하면 충분히 통합니다.</div>
      <button class="btn-primary" style="width:100%;" onclick="speakLocal('${phrase.replace(/'/g,"\\'")}','${region.langCode}')">🔊 이 문구 발음 듣기</button>
    </div>`;
}

/* =====================================================================
   MEMO & SHOPPING
===================================================================== */
function addMemo(){
  const input = document.getElementById('memoInput');
  const val = input.value.trim(); if(!val) return;
  state.memos.unshift({text:val, ts:new Date().toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})});
  persist(); input.value=''; renderMemo();
}
function deleteMemo(i){ state.memos.splice(i,1); persist(); renderMemo(); }
function renderMemo(){
  const list = document.getElementById('memoList');
  if(state.memos.length===0){ list.innerHTML = `<div style="font-size:12.5px; color:var(--muted); text-align:center; padding:14px 0;">아직 저장된 메모가 없습니다.</div>`; return; }
  list.innerHTML = state.memos.map((m,i)=>`<div class="memo-item"><span class="memo-del" onclick="deleteMemo(${i})">×</span><div class="ts">${esc(m.ts)}</div>${esc(m.text)}</div>`).join('');
}
function renderShopping(){
  const body = document.getElementById('shoppingBody');
  let html = `<div class="card jump-card">
    <span class="jump-label">📍 바로가기</span>
    <select class="jump-select" onchange="if(this.value) jumpToSection(this.value); this.value='';">
      <option value="">장소 선택…</option>
      ${state.shopping.map(grp=>`<option value="shop-${grp.id}">${esc(grp.country)} ${esc(grp.city)}</option>`).join('')}
    </select>
  </div>`;
  state.shopping.forEach(grp=>{
    html += `<div class="card" id="shop-${grp.id}" style="margin-bottom:12px;">
      <div class="shop-city" style="display:flex; justify-content:space-between; align-items:center; margin-top:0;">
        <div><span class="shop-country-tag">${esc(grp.country)}</span>${esc(grp.city)}</div>
        <div style="display:flex; gap:8px;">
          <span class="icon-btn" onclick="editShopGroup('${grp.id}')">✎</span>
          <span class="icon-btn danger" onclick="deleteShopGroup('${grp.id}')">🗑</span>
        </div>
      </div>`;
    grp.items.forEach(item=>{
      html += `<div class="chk-item-wrap">
        <div class="chk-item">
          <div class="chk-box ${item.checked?'on':''}" onclick="toggleShopItem('${grp.id}','${item.id}')"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div>
          <div class="chk-label ${item.checked?'done':''}" style="font-size:13px;">${esc(item.label)}</div>
          <span class="icon-btn" onclick="editShopItem('${grp.id}','${item.id}')">✎</span>
          <span class="icon-btn danger" onclick="deleteShopItem('${grp.id}','${item.id}')">×</span>
        </div>
        <input class="chk-note-input" value="${esc(item.note||'')}" placeholder="비고 (선택)" oninput="updateShopNote('${grp.id}','${item.id}', this.value); flashSaved(this)">
      </div>`;
    });
    html += `<div style="display:flex; gap:6px; margin-top:9px;">
        <input id="newshopitem-${grp.id}" placeholder="새 항목 추가" style="flex:1; border:1px solid var(--line); border-radius:8px; padding:7px 9px; font-size:12.5px;" onkeydown="if(event.key==='Enter')addShopItem('${grp.id}')">
        <button class="btn-ghost" onclick="addShopItem('${grp.id}')">추가</button>
      </div>`;
    if(grp.loc) html += `<div style="font-size:11.5px; color:var(--muted); margin-top:8px;">📍 ${esc(grp.loc)}</div>`;
    html += `</div>`;
  });
  html += `<div class="card">
    <div class="section-label" style="margin-bottom:8px;">새 쇼핑 장소 추가</div>
    <div class="formGrid">
      <input id="newShopCountry" placeholder="국가 (예: 대만)" style="border:1px solid var(--line); border-radius:8px; padding:9px 10px; font-size:13px;">
      <input id="newShopCity" placeholder="도시/장소 (예: 가오슝)" style="border:1px solid var(--line); border-radius:8px; padding:9px 10px; font-size:13px;">
    </div>
    <button class="btn-primary" style="width:100%; margin-top:9px;" onclick="addShopGroup()">장소 추가</button>
  </div>`;
  body.innerHTML = html;
}
function toggleShopItem(groupId, itemId){
  const grp = state.shopping.find(g=>g.id===groupId);
  const item = grp.items.find(i=>i.id===itemId);
  item.checked = !item.checked; persist(); renderShopping();
}
function editShopItem(groupId, itemId){
  const grp = state.shopping.find(g=>g.id===groupId);
  const item = grp.items.find(i=>i.id===itemId);
  const val = prompt('항목 이름 수정', item.label);
  if(val===null || !val.trim()) return;
  item.label = val.trim(); persist(); renderShopping();
}
function deleteShopItem(groupId, itemId){
  if(!confirm('이 항목을 삭제할까요?')) return;
  const grp = state.shopping.find(g=>g.id===groupId);
  grp.items = grp.items.filter(i=>i.id!==itemId); persist(); renderShopping();
}
function updateShopNote(groupId, itemId, val){
  const grp = state.shopping.find(g=>g.id===groupId);
  const item = grp.items.find(i=>i.id===itemId);
  item.note = val; persist();
}
function addShopItem(groupId){
  const input = document.getElementById('newshopitem-'+groupId);
  const val = input.value.trim(); if(!val) return;
  const grp = state.shopping.find(g=>g.id===groupId);
  grp.items.push({id:uid('sitem'), label:val, note:'', checked:false});
  input.value=''; persist(); renderShopping();
}
function editShopGroup(groupId){
  const grp = state.shopping.find(g=>g.id===groupId);
  const country = prompt('국가 이름 수정', grp.country);
  if(country===null) return;
  const city = prompt('도시/장소 이름 수정', grp.city);
  if(city===null) return;
  grp.country = country.trim()||grp.country; grp.city = city.trim()||grp.city;
  persist(); renderShopping();
}
function deleteShopGroup(groupId){
  if(!confirm('이 쇼핑 장소 전체를 삭제할까요?')) return;
  state.shopping = state.shopping.filter(g=>g.id!==groupId); persist(); renderShopping();
}
function addShopGroup(){
  const country = document.getElementById('newShopCountry').value.trim();
  const city = document.getElementById('newShopCity').value.trim();
  if(!city){ alert('도시/장소 이름을 입력해주세요.'); return; }
  state.shopping.push({id:uid('shop'), country: country||'미지정', city, loc:'', items:[]});
  document.getElementById('newShopCountry').value=''; document.getElementById('newShopCity').value='';
  persist(); renderShopping();
}

/* =====================================================================
   SYNC (Google Apps Script Web App)
===================================================================== */
function renderSyncStatus(){
  const el = document.getElementById('syncStatus');
  if(el) el.textContent = state.meta.lastSync ? ('마지막 동기화: '+new Date(state.meta.lastSync).toLocaleString('ko-KR')) : '아직 동기화한 적 없음';
}
function syncUpload(evt){
  if(!state.meta.webhookUrl){ alert('동기화 웹앱 주소가 설정되어 있지 않습니다. app.js 상단의 DEFAULT_WEBHOOK_URL을 확인해주세요.'); return; }
  const btn = evt.target; const orig = btn.textContent; btn.disabled = true; btn.textContent = '업로드 중…';
  fetch(state.meta.webhookUrl, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(state)})
    .then(r=>r.json())
    .then(()=>{ state.meta.lastSync = new Date().toISOString(); persist(); renderSyncStatus(); alert('업로드 완료! 같이 가는 분 기기에서 "지금 불러오기"를 누르면 받아볼 수 있어요.'); })
    .catch(err=>{ alert('업로드 실패: '+err.message+'\n웹앱 배포 설정(액세스 권한: 전체 허용)을 확인해주세요.'); })
    .finally(()=>{ btn.disabled=false; btn.textContent=orig; });
}
function syncDownload(){
  if(!state.meta.webhookUrl){ alert('동기화 웹앱 주소가 설정되어 있지 않습니다. app.js 상단의 DEFAULT_WEBHOOK_URL을 확인해주세요.'); return; }
  fetch(state.meta.webhookUrl).then(r=>r.json()).then(data=>{
    if(!data || !data.days){ alert('서버에 저장된 데이터가 없습니다. 먼저 "지금 업로드"를 눌러주세요.'); return; }
    if(confirm('불러온 데이터로 이 기기 내용을 덮어씁니다. 계속할까요?')){
      const url = state.meta.webhookUrl;
      state = data;
      state.meta = state.meta || {};
      state.meta.webhookUrl = url;
      state.meta.lastSync = new Date().toISOString();
      persist(); location.reload();
    }
  }).catch(err=>alert('불러오기 실패: '+err.message));
}
function openSyncHelp(){
  openModal('구글시트 동기화 설정 방법',
`1) 구글 드라이브에서 새 스프레드시트를 만듭니다.
2) 상단 메뉴 확장 프로그램 > Apps Script 클릭.
3) 함께 제공된 GoogleAppsScript_Code.gs 내용 전체를 붙여넣기.
4) 우측 상단 배포 > 새 배포 선택.
   - 유형: 웹 앱
   - 실행 계정: 나
   - 액세스 권한: 전체 허용
5) 배포 후 나오는 웹 앱 URL을 복사해서 app.js 상단의 DEFAULT_WEBHOOK_URL에 붙여넣습니다.
6) "지금 업로드"로 현재 데이터를 올리고, 같이 가는 분 기기에서는 "지금 불러오기"로 받아오면 됩니다.

※ 자동 실시간 동기화가 아니라 수동 업로드/불러오기 방식입니다. 현지에서 일정을 바꾼 뒤에는 "지금 업로드"를 눌러주는 것을 잊지 마세요.`);
}

/* =====================================================================
   MODAL (info)
===================================================================== */
function openModal(title, body){
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').textContent = body;
  document.getElementById('modalBg').style.display = 'flex';
}
function closeModal(){ document.getElementById('modalBg').style.display = 'none'; }
function openFormModal(html){
  document.getElementById('formModalContent').innerHTML = html;
  document.getElementById('formModalBg').style.display = 'flex';
}
function closeFormModal(){ document.getElementById('formModalBg').style.display = 'none'; }

/* --- 긴급 링크(여권사본/여행자보험/의약품정보) 첨부 --- */
function openAttachQuickModal(kind, title){
  if(!state.meta[kind]) state.meta[kind] = {attachUrl:'', attachName:'', attachFileId:''};
  const target = state.meta[kind];
  const html = `
    <div class="font-display" style="font-size:17px; font-weight:700; margin-bottom:10px;">${esc(title)}</div>
    <div id="attach_display">${renderAttachDisplay(target, 'meta', kind)}</div>
    <input type="file" id="attach_input" accept="application/pdf,image/*" onchange="uploadAttachment('meta','${kind}', this)">
    <div id="attach_status" style="font-size:11px; color:var(--muted); margin:4px 0 8px;"></div>
    <div style="font-size:11px; color:var(--muted); margin-top:6px;">PDF나 사진 파일을 올려두면 함께 가는 분도 이 화면에서 언제든 열어볼 수 있어요.</div>
    <button class="btn-cancel" onclick="closeFormModal()">닫기</button>`;
  openFormModal(html);
}

/* =====================================================================
   INIT
===================================================================== */
renderDashboard();
renderChecklist();
renderMemo();
renderShopping();
