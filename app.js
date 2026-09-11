/* =====================================================================
   ⚙️ 동기화 설정 — 이 트립 전용 구글 앱스 스크립트를 새로 배포한 뒤
   그 웹앱 URL을 여기에 넣으면 동기화 버튼이 바로 동작합니다.
   (GoogleAppsScript_Code_Taiwan.gs 참고. 배포 전에는 비워두면 되고,
    이 경우 "지금 업로드/불러오기"를 누르면 안내 문구만 뜨고 앱은 정상 동작합니다)
===================================================================== */
const DEFAULT_WEBHOOK_URL = '';

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
  {period:'오후', tag:'이동', title:'인천→가오슝 도착 · 공항→호텔(미려도역) 이동', time:'13:05–17:00', place:'가오슝 국제공항 → 그리트 인', tip:'입국심사·수하물 수령 후 MRT 또는 우버로 미려도역 인근 호텔 이동, 체크인. 4인 이동+짐 있어 우버 추천.', map:'Greet Inn Kaohsiung'},
  {period:'저녁', tag:'식사', title:'★ 향원우육면(港園牛肉麵) 저녁', time:'18:00', place:'항원우육면', tip:'우육 탕면·비빔면 + 오이무침. 외부 음료·주류 반입 가능해 편의점 맥주 지참 추천.', map:'港園牛肉麵 高雄'},
  {period:'저녁', tag:'관광', title:'보얼예술특구 산책·야경 & 써니힐 펑리수', time:'19:30', place:'보얼예술특구', tip:'창고 개조 전시거리 야경 산책 후, 써니힐 매장에서 무료 차&펑리수 시식하고 선물용 구매.', map:'Pier-2 Art Center Kaohsiung'},
  {period:'밤', tag:'쇼핑', title:'리우허(六合) 야시장', time:'21:00', place:'류허 야시장', tip:'호텔 도보 5분. 먹거리·맥주 포장해서 호텔로 복귀.', map:'Liuhe Night Market Kaohsiung'},
  {period:'밤', tag:'식사', title:'호텔 라운지 야식 & 담소', time:'22:00', place:'그리트 인 조식당 라운지', tip:'무료 커피·음료·다과가 상시 개방된 라운지에서 야시장 먹거리 나눠 먹기.', map:''},
]},
{date:'2026-09-18', label:'9/18(금)', city:'가오슝', country:'대만', stay:'그리트 인(Greet Inn)', blocks:[
  {period:'아침', tag:'식사', title:'조식 (이른 아침)', time:'07:30', place:'숙소', tip:'부모님 기상 시간에 맞춰 이른 식사.', map:''},
  {period:'오전', tag:'관광', title:'연지담(蓮池潭) 용호탑', time:'09:00', place:'연지담', tip:'우버로 이동(약 25분). 용 입으로 들어가 호랑이 입으로 나오기.', map:'Lotus Pond Dragon Tiger Pagodas Kaohsiung'},
  {period:'오후', tag:'식사', title:'★ 딘타이펑(한신백화점 지하) 점심', time:'11:30', place:'한신백화점 딘타이펑', tip:'오픈 시간 맞춰 방문 추천. 샤오롱바오·갈비볶음밥·탄탄면.', map:'汉神百货 鼎泰丰 高雄'},
  {period:'오후', tag:'식사', title:'구산 페리터미널 이동 · 하이지빙 망고빙수', time:'13:30', place:'渡船頭海之冰', tip:'페리 승선 전 망고빙수로 더위 식히기.', map:'渡船頭海之冰 高雄'},
  {period:'오후', tag:'이동', title:'치진섬 페리 탑승', time:'14:30', place:'구산 → 치진 페리', tip:'전동 자전거 대여는 지양, 도보·차량 위주로 이동(부모님 관절 부담 고려).', map:''},
  {period:'늦은오후', tag:'관광', title:'치진섬 둘러보기 & 선셋바 일몰', time:'15:00', place:'치진섬', tip:'선셋바 등에서 일몰 감상하며 맥주 한잔.', map:'Cijin Beach Kaohsiung'},
  {period:'늦은오후', tag:'관광', title:'(선택) 다카오 영국영사관', time:'17:00', place:'打狗英國領事館', tip:'일몰 명소로도 유명. 공사 여부는 현장에서 확인 필요.', map:'Former British Consulate at Takao'},
  {period:'저녁', tag:'식사', title:'후덕복(만두) 또는 1인 훠궈', time:'19:00', place:'厚德福 또는 훠궈 전문점', tip:'만두·딤섬 노포 후덕복, 또는 개인 화로 1인 훠궈 전문점 중 선택.', map:'厚德福 高雄'},
  {period:'밤', tag:'쇼핑', title:'노강(라오지앙) 밀크티·딴빙 구매', time:'21:00', place:'老江紅茶牛奶', tip:'밀크티·딴빙 및 누가크래커 선물용 구매. 대량 구매 시 덤 증정 확인.', map:'老江紅茶牛奶 高雄'},
]},
{date:'2026-09-19', label:'9/19(토)', city:'가오슝 → 인천', country:'귀국일', stay:'그리트 인(Greet Inn, 체크아웃)', blocks:[
  {period:'아침', tag:'식사', title:'조식 & 체크아웃', time:'08:00', place:'숙소', tip:'짐은 프런트에 보관 요청.', map:''},
  {period:'오전', tag:'관광', title:'가오슝 역사박물관 관람', time:'09:00', place:'가오슝 역사박물관', tip:'호텔 도보 15분권, 가벼운 관광.', map:'Kaohsiung Museum of History'},
  {period:'오전', tag:'쇼핑', title:'85타워 전망 / 기념품 쇼핑', time:'11:00', place:'85타워 인근', tip:'가오슝 랜드마크, 대립백화점 인근.', map:'85 Sky Tower Kaohsiung'},
  {period:'오후', tag:'식사', title:'★ 점심 - 난펑루러우판(南豐滷肉飯)', time:'12:00', place:'南豐滷肉飯', tip:'가오슝 대표 루러우판(고기 양념 덮밥) 노포. 마지막 식사로 부담 없이 즐기기 좋음.', map:'南豐滷肉飯 高雄'},
  {period:'오후', tag:'이동', title:'짐 찾고 공항 이동', time:'13:00', place:'그리트 인 → 가오슝 국제공항', tip:'택시 또는 MRT(메이리다오 환승), 약 20~30분.', map:'Kaohsiung International Airport'},
  {period:'오후', tag:'이동', title:'가오슝 → 인천 출발', time:'16:10', place:'가오슝 국제공항', tip:'국제선 2시간 전 도착 기준. 20:00 인천 도착 예정.', map:''},
]},
];

const SEED_POOL = [
 {city:'가오슝', title:'루이펑 야시장(瑞豐夜市)', desc:'가오슝 최대 규모 현지인 야시장. 화·목·금·토·일 영업(월·수 휴무). 톈스지파이(닭튀김) 유명.', map:'Ruifeng Night Market Kaohsiung'},
 {city:'가오슝', title:'메이리다오역 光之穹頂(빛의 돔)', desc:'MRT 미려도역, 세계 최대 규모 스테인드글라스 천장 야경.', map:'Formosa Boulevard Station Dome of Light Kaohsiung'},
 {city:'가오슝', title:'치진섬 치허우 포대 & 별빛 터널', desc:'치진 등대까지 이어지는 언덕길, 항구 전망 좋음. 치진섬 방문 시 추가 코스로.', map:'Cijin Fort Kaohsiung'},
 {city:'가오슝', title:'하마싱 철도문화원구', desc:'옛 철도역 개조 전시 공간, 구산 페리 인근 도보 이동.', map:'Hamasen Railway Cultural Park Kaohsiung'},
 {city:'가오슝', title:'아이허 강변 산책 & 시즈완 노을', desc:'항구도시 대표 일몰 명소. 강변 따라 도보 또는 유람선.', map:'Love River Kaohsiung'},
 {city:'가오슝', title:'가오슝 뮤직센터(高雄流行音樂中心)', desc:'아이허 하구의 독특한 건축, 산책하기 좋은 야경 명소.', map:'Kaohsiung Music Center'},
 {city:'가오슝', title:'흥륭거(興隆居)', desc:'전통 조식 노포. 왕만두(탕포)와 샤오빙·딴빙이 유명.', map:'Xinglongju Kaohsiung'},
 {city:'가오슝', title:'85도씨 커피(85度C)', desc:'대만 국민 카페 체인. 커피+빵 간단 아침/간식.', map:'85C Bakery Cafe Kaohsiung Qianjin'},
 {city:'가오슝', title:'다관백화점 · 한신백화점', desc:'가오슝 대표 쇼핑몰, 실내 냉방 완비라 더운 낮에 쉬어가기 좋음.', map:'Han Shin Department Store Kaohsiung'},
 {city:'가오슝', title:'야러우전(鴨肉珍)', desc:'오리고기 덮밥·내장탕 노포. 오리고기 수육도 인기.', map:'鴨肉珍 高雄'},
 {city:'가오슝', title:'단단버거(丹丹漢堡)', desc:'대만 남부 대표 패스트푸드 체인. 치킨버거+국수 세트가 인기.', map:'丹丹漢堡 高雄'},
 {city:'가오슝', title:'화달밀크티(樺達奶茶)', desc:'원조 밀크티 전문점. 당도별로 메뉴 이름이 다른 게 특징(미용내차 추천).', map:'樺達奶茶 高雄'},
 {city:'가오슝', title:'정라오파이 목과우유(鄭老牌木瓜牛奶)', desc:'가오슝 대표 파파야우유·생과일주스 전문점.', map:'鄭老牌木瓜牛奶 高雄'},
 {city:'가오슝', title:'천사지파이(天使雞排)', desc:'두툼한 대왕 닭튀김. 육즙 보존 위해 자르지 않고 통째로 제공.', map:'天使雞排 高雄'},
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
 {cat:'카페 & 식당', kr:'몇 분이세요? / 네 명입니다.', zh:'請問幾位？四位。', py:'Qǐngwèn jǐ wèi? Sì wèi.'},
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
  {id:'houdefu', flag:'🇹🇼', label:'후덕복 (만두·딤섬·전병)', langCode:'zh-TW'},
  {id:'gangyuan', flag:'🇹🇼', label:'항원우육면 (우육면·비빔면)', langCode:'zh-TW'},
  {id:'yaroujen', flag:'🇹🇼', label:'야러우전 (오리고기·내장탕)', langCode:'zh-TW'},
  {id:'xinglongju', flag:'🇹🇼', label:'흥륭거 (전통 조식·탕포·샤오빙)', langCode:'zh-TW'},
  {id:'laojiang', flag:'🇹🇼', label:'라오지앙 (홍차우유·토스트·딴빙)', langCode:'zh-TW'},
  {id:'dandan', flag:'🇹🇼', label:'단단버거 (패스트푸드·치킨·국수)', langCode:'zh-TW'},
  {id:'huada', flag:'🇹🇼', label:'화달밀크티 (원조 밀크티·차)', langCode:'zh-TW'},
  {id:'dingtaifeng', flag:'🇹🇼', label:'딘타이펑 (샤오롱바오·딤섬)', langCode:'zh-TW'},
  {id:'haizhibing', flag:'🇹🇼', label:'도선두 해지빙 (대야 빙수)', langCode:'zh-TW'},
  {id:'zhenglaopai', flag:'🇹🇼', label:'정라오파이 (파파야우유·생과일)', langCode:'zh-TW'},
  {id:'tianshi', flag:'🇹🇼', label:'천사지파이 (대왕 닭튀김·스낵)', langCode:'zh-TW'},
];

const RESTAURANT_INTRO = {
  houdefu: [
    {kr:'안녕하세요. 저희는 네 명입니다. 자리가 있나요?', local:'你好，我們四位，請問有位子嗎？'},
    {kr:'메뉴판 좀 부탁드립니다.', local:'請給我菜單。'},
    {kr:'혹시 추천해 주실 메뉴가 있나요?', local:'請問有推薦的菜嗎？'},
    {kr:'조금 이따가 다시 부를게요, 아직 고르는 중이에요.', local:'我們再看一下菜單，謝謝。'},
    {kr:'주문할게요.', local:'我們要點餐了。'},
    {kr:'덜 맵게 해주세요.', local:'請不要太辣。'},
    {kr:'화장실 어디 있어요?', local:'請問洗手間在哪裡？'},
    {kr:'와이파이 있나요?', local:'請問有Wi-Fi嗎？'},
    {kr:'현금만 받나요, 카드도 되나요?', local:'請問只能付現金，還是也可以刷卡？'},
  ],
  gangyuan: [
    {kr:'안녕하세요. 저희는 네 명입니다. 자리가 있나요?', local:'你好，我們四位，請問有位子嗎？'},
    {kr:'메뉴판 좀 부탁드립니다.', local:'請給我菜單。'},
    {kr:'혹시 추천해 주실 메뉴가 있나요?', local:'請問有推薦的菜嗎？'},
    {kr:'조금 이따가 다시 부를게요, 아직 고르는 중이에요.', local:'我們再看一下菜單，謝謝。'},
    {kr:'주문할게요.', local:'我們要點餐了。'},
    {kr:'덜 맵게 해주세요.', local:'請不要太辣。'},
    {kr:'화장실 어디 있어요?', local:'請問洗手間在哪裡？'},
    {kr:'와이파이 있나요?', local:'請問有Wi-Fi嗎？'},
    {kr:'현금만 받나요, 카드도 되나요?', local:'請問只能付現金，還是也可以刷卡？'},
  ],
  yaroujen: [
    {kr:'안녕하세요. 저희는 네 명입니다. 자리가 있나요?', local:'你好，我們四位，請問有位子嗎？'},
    {kr:'메뉴판 좀 부탁드립니다.', local:'請給我菜單。'},
    {kr:'혹시 추천해 주실 메뉴가 있나요?', local:'請問有推薦的菜嗎？'},
    {kr:'조금 이따가 다시 부를게요, 아직 고르는 중이에요.', local:'我們再看一下菜單，謝謝。'},
    {kr:'주문할게요.', local:'我們要點餐了。'},
    {kr:'덜 맵게 해주세요.', local:'請不要太辣。'},
    {kr:'화장실 어디 있어요?', local:'請問洗手間在哪裡？'},
    {kr:'와이파이 있나요?', local:'請問有Wi-Fi嗎？'},
    {kr:'현금만 받나요, 카드도 되나요?', local:'請問只能付現金，還是也可以刷卡？'},
  ],
  xinglongju: [
    {kr:'안녕하세요. 저희는 네 명입니다. 자리가 있나요?', local:'你好，我們四位，請問有位子嗎？'},
    {kr:'메뉴판 좀 부탁드립니다.', local:'請給我菜單。'},
    {kr:'혹시 추천해 주실 메뉴가 있나요?', local:'請問有推薦的菜嗎？'},
    {kr:'조금 이따가 다시 부를게요, 아직 고르는 중이에요.', local:'我們再看一下菜單，謝謝。'},
    {kr:'주문할게요.', local:'我們要點餐了。'},
    {kr:'덜 맵게 해주세요.', local:'請不要太辣。'},
    {kr:'화장실 어디 있어요?', local:'請問洗手間在哪裡？'},
    {kr:'와이파이 있나요?', local:'請問有Wi-Fi嗎？'},
    {kr:'현금만 받나요, 카드도 되나요?', local:'請問只能付現金，還是也可以刷卡？'},
  ],
  laojiang: [
    {kr:'안녕하세요. 저희는 네 명입니다. 자리가 있나요?', local:'你好，我們四位，請問有位子嗎？'},
    {kr:'메뉴판 좀 부탁드립니다.', local:'請給我菜單。'},
    {kr:'혹시 추천해 주실 메뉴가 있나요?', local:'請問有推薦的菜嗎？'},
    {kr:'조금 이따가 다시 부를게요, 아직 고르는 중이에요.', local:'我們再看一下菜單，謝謝。'},
    {kr:'주문할게요.', local:'我們要點餐了。'},
    {kr:'덜 맵게 해주세요.', local:'請不要太辣。'},
    {kr:'화장실 어디 있어요?', local:'請問洗手間在哪裡？'},
    {kr:'와이파이 있나요?', local:'請問有Wi-Fi嗎？'},
    {kr:'현금만 받나요, 카드도 되나요?', local:'請問只能付現金，還是也可以刷卡？'},
  ],
  dandan: [
    {kr:'안녕하세요. 저희는 네 명입니다. 자리가 있나요?', local:'你好，我們四位，請問有位子嗎？'},
    {kr:'메뉴판 좀 부탁드립니다.', local:'請給我菜單。'},
    {kr:'혹시 추천해 주실 메뉴가 있나요?', local:'請問有推薦的菜嗎？'},
    {kr:'조금 이따가 다시 부를게요, 아직 고르는 중이에요.', local:'我們再看一下菜單，謝謝。'},
    {kr:'주문할게요.', local:'我們要點餐了。'},
    {kr:'덜 맵게 해주세요.', local:'請不要太辣。'},
    {kr:'화장실 어디 있어요?', local:'請問洗手間在哪裡？'},
    {kr:'와이파이 있나요?', local:'請問有Wi-Fi嗎？'},
    {kr:'현금만 받나요, 카드도 되나요?', local:'請問只能付現金，還是也可以刷卡？'},
  ],
  huada: [
    {kr:'안녕하세요. 저희는 네 명입니다. 자리가 있나요?', local:'你好，我們四位，請問有位子嗎？'},
    {kr:'메뉴판 좀 부탁드립니다.', local:'請給我菜單。'},
    {kr:'혹시 추천해 주실 메뉴가 있나요?', local:'請問有推薦的菜嗎？'},
    {kr:'조금 이따가 다시 부를게요, 아직 고르는 중이에요.', local:'我們再看一下菜單，謝謝。'},
    {kr:'주문할게요.', local:'我們要點餐了。'},
    {kr:'덜 맵게 해주세요.', local:'請不要太辣。'},
    {kr:'화장실 어디 있어요?', local:'請問洗手間在哪裡？'},
    {kr:'와이파이 있나요?', local:'請問有Wi-Fi嗎？'},
    {kr:'현금만 받나요, 카드도 되나요?', local:'請問只能付現金，還是也可以刷卡？'},
  ],
  dingtaifeng: [
    {kr:'안녕하세요. 저희는 네 명입니다. 자리가 있나요?', local:'你好，我們四位，請問有位子嗎？'},
    {kr:'메뉴판 좀 부탁드립니다.', local:'請給我菜單。'},
    {kr:'혹시 추천해 주실 메뉴가 있나요?', local:'請問有推薦的菜嗎？'},
    {kr:'조금 이따가 다시 부를게요, 아직 고르는 중이에요.', local:'我們再看一下菜單，謝謝。'},
    {kr:'주문할게요.', local:'我們要點餐了。'},
    {kr:'덜 맵게 해주세요.', local:'請不要太辣。'},
    {kr:'화장실 어디 있어요?', local:'請問洗手間在哪裡？'},
    {kr:'와이파이 있나요?', local:'請問有Wi-Fi嗎？'},
    {kr:'현금만 받나요, 카드도 되나요?', local:'請問只能付現金，還是也可以刷卡？'},
  ],
  haizhibing: [
    {kr:'안녕하세요. 저희는 네 명입니다. 자리가 있나요?', local:'你好，我們四位，請問有位子嗎？'},
    {kr:'메뉴판 좀 부탁드립니다.', local:'請給我菜單。'},
    {kr:'혹시 추천해 주실 메뉴가 있나요?', local:'請問有推薦的菜嗎？'},
    {kr:'조금 이따가 다시 부를게요, 아직 고르는 중이에요.', local:'我們再看一下菜單，謝謝。'},
    {kr:'주문할게요.', local:'我們要點餐了。'},
    {kr:'덜 맵게 해주세요.', local:'請不要太辣。'},
    {kr:'화장실 어디 있어요?', local:'請問洗手間在哪裡？'},
    {kr:'와이파이 있나요?', local:'請問有Wi-Fi嗎？'},
    {kr:'현금만 받나요, 카드도 되나요?', local:'請問只能付現金，還是也可以刷卡？'},
  ],
  zhenglaopai: [
    {kr:'안녕하세요. 저희는 네 명입니다. 자리가 있나요?', local:'你好，我們四位，請問有位子嗎？'},
    {kr:'메뉴판 좀 부탁드립니다.', local:'請給我菜單。'},
    {kr:'혹시 추천해 주실 메뉴가 있나요?', local:'請問有推薦的菜嗎？'},
    {kr:'조금 이따가 다시 부를게요, 아직 고르는 중이에요.', local:'我們再看一下菜單，謝謝。'},
    {kr:'주문할게요.', local:'我們要點餐了。'},
    {kr:'덜 맵게 해주세요.', local:'請不要太辣。'},
    {kr:'화장실 어디 있어요?', local:'請問洗手間在哪裡？'},
    {kr:'와이파이 있나요?', local:'請問有Wi-Fi嗎？'},
    {kr:'현금만 받나요, 카드도 되나요?', local:'請問只能付現金，還是也可以刷卡？'},
  ],
  tianshi: [
    {kr:'안녕하세요. 저희는 네 명입니다. 자리가 있나요?', local:'你好，我們四位，請問有位子嗎？'},
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

const RESTAURANT_FOOD = {
  houdefu: [
    {id:'houdefu_01', emoji:'🥟', kr:'돼지고기 전병 (육즙 군만두파이)', local:'豬肉餡餅', py:'zhūròu xiànbǐng'},
    {id:'houdefu_02', emoji:'🥟', kr:'소고기 전병', local:'牛肉餡餅', py:'niúròu xiànbǐng'},
    {id:'houdefu_03', emoji:'🥟', kr:'총유빙 (파 전병)', local:'蔥油餅', py:'cōngyóubǐng'},
    {id:'houdefu_04', emoji:'🥟', kr:'로빙 (달콤한 맛 찢어먹는 팬케이크형 전병)', local:'烙餅(甜味)', py:'làobǐng (tiánwèi)'},
    {id:'houdefu_05', emoji:'🥟', kr:'로빙 (짭조름한 짠맛 전병)', local:'烙餅(鹹味)', py:'làobǐng (xiánwèi)'},
    {id:'houdefu_06', emoji:'🥟', kr:'돼지고기 롤 전병', local:'豬肉捲餅', py:'zhūròu juǎnbǐng'},
    {id:'houdefu_07', emoji:'🥟', kr:'소고기 롤 전병', local:'牛肉捲餅', py:'niúròu juǎnbǐng'},
    {id:'houdefu_08', emoji:'🥟', kr:'알팔파 새싹 롤 전병', local:'苜蓿芽捲餅', py:'mùxuyá juǎnbǐng'},
    {id:'houdefu_09', emoji:'🥟', kr:'돼지고기 샤오롱바오 (소롱포, 7개)', local:'鮮肉湯包(7粒/籠)', py:'xiānròu tāngbāo'},
    {id:'houdefu_10', emoji:'🥟', kr:'게살/게알 샤오롱바오 (8개)', local:'蟹黃湯包(8粒/籠)', py:'xièhuáng tāngbāo'},
    {id:'houdefu_11', emoji:'🥟', kr:'수세미오이 새우 샤오롱바오 (8개)', local:'絲瓜蝦仁湯包(8粒/籠)', py:'sīguā xiārén tāngbāo'},
    {id:'houdefu_12', emoji:'🥟', kr:'소고기 찐만두 (7개)', local:'牛肉蒸餃(7粒/籠)', py:'niúròu zhēngjiǎo'},
    {id:'houdefu_13', emoji:'🥟', kr:'삼선 찐만두 (해물·고기 등, 7개)', local:'三鮮蒸餃(7粒/籠)', py:'sānxiān zhēngjiǎo'},
    {id:'houdefu_14', emoji:'🥟', kr:'채식 야채 찐만두 (7개)', local:'翡翠花素蒸餃(7粒/籠)', py:'fěicuì huāsù zhēngjiǎo'},
    {id:'houdefu_15', emoji:'🥟', kr:'참치 로티(인도식 크레페 전병)', local:'鮪魚飛餅', py:'wěiyú fēibǐng'},
    {id:'houdefu_16', emoji:'🥟', kr:'단팥 로티 전병', local:'相思飛餅', py:'xiāngsī fēibǐng'},
    {id:'houdefu_17', emoji:'🥟', kr:'땅콩 로티 전병', local:'花生飛餅', py:'huāshēng fēibǐng'},
    {id:'houdefu_18', emoji:'🥟', kr:'초콜릿 로티 전병', local:'巧克力飛餅', py:'qiǎokèlì fēibǐng'},
    {id:'houdefu_19', emoji:'🥟', kr:'백김치(쏸차이) 삼겹살 훠궈 (전골)', local:'酸菜白肉火鍋', py:'suāncài báiròu huǒguō'},
    {id:'houdefu_20', emoji:'🥟', kr:'양고기 훠궈 (전골)', local:'羊肉火鍋', py:'yángròu huǒguō'},
    {id:'houdefu_21', emoji:'🥟', kr:'우겅창왕 (돼지곱창과 오리선지 매운 뚝배기 요리)', local:'五更腸旺', py:'wǔgēng chángwàng'},
    {id:'houdefu_22', emoji:'🥟', kr:'소고기 볶음 묘이도 (수제비 모양 파스타 볶음)', local:'炒牛肉貓耳朵', py:'chǎo niúròu māo\'ěrduo'},
    {id:'houdefu_23', emoji:'🥟', kr:'삼선 볶음 묘이도 (해물 수제비 볶음)', local:'炒三鮮貓耳朵', py:'chǎo sānxiān māo\'ěrduo'},
    {id:'houdefu_24', emoji:'🥟', kr:'마(산약) 튀김 롤', local:'山藥捲', py:'shānyao juǎn'},
    {id:'houdefu_25', emoji:'🥟', kr:'해물 튀김 롤', local:'海鮮捲', py:'hǎixiān juǎn'},
    {id:'houdefu_26', emoji:'🥟', kr:'부용 서시 롤 (두부/해물 춘권식 튀김 롤)', local:'芙蓉西施捲', py:'fúróng xīshī juǎn'},
    {id:'houdefu_27', emoji:'🥟', kr:'계절 채소 볶음', local:'炒青菜', py:'chǎo qīngcài'},
    {id:'houdefu_28', emoji:'🥟', kr:'대만식 돼지갈비 튀김 (단품)', local:'炸排骨', py:'zhá páigǔ'},
    {id:'houdefu_29', emoji:'🥟', kr:'새우 부추 물만두 (최소 5개 이상 주문)', local:'鮮蝦韭黃水餃(最少5顆)', py:'xiānxiā jiǔhuáng shuǐjiǎo'},
    {id:'houdefu_30', emoji:'🥟', kr:'홍유초수 (매콤한 고추기름 훈툰/물만두)', local:'紅油抄手', py:'hóngyóu chāoshǒu'},
    {id:'houdefu_31', emoji:'🥟', kr:'홍유초수 비빔면', local:'紅油抄手拌麵', py:'hóngyóu chāoshǒu bànmiàn'},
    {id:'houdefu_32', emoji:'🥟', kr:'홍유 피단(삭힌 오리알) 비빔면', local:'紅油皮蛋拌麵', py:'hóngyóu pídàn bànmiàn'},
    {id:'houdefu_33', emoji:'🥟', kr:'자장면 (대만식 된장 비빔면)', local:'炸醬麵', py:'zhájiàngmiàn'},
    {id:'houdefu_34', emoji:'🥟', kr:'원즙 우육면', local:'原汁牛肉麵', py:'yuánzhī niúròumiàn'},
    {id:'houdefu_35', emoji:'🥟', kr:'산라면 (새콤매콤 쏸라탕면)', local:'酸辣麵', py:'suānlàmiàn'},
    {id:'houdefu_36', emoji:'🥟', kr:'자차이 돼지고기채 국수 (탕면/비빔면 선택 가능)', local:'榨菜肉絲麵', py:'zhàcài ròusīmiàn'},
    {id:'houdefu_37', emoji:'🥟', kr:'돼지갈비 국수 (탕면/비빔면 선택 가능)', local:'排骨麵', py:'páigǔmiàn'},
    {id:'houdefu_38', emoji:'🥟', kr:'새우 훈툰(완탕) 국수 (탕면/비빔면 선택 가능)', local:'鮮蝦餛飩麵', py:'xiānxiā húntunmiàn'},
    {id:'houdefu_39', emoji:'🥟', kr:'원즙 우육탕 (면 없는 고기 국물)', local:'原汁牛肉湯', py:'yuánzhī niúròutāng'},
    {id:'houdefu_40', emoji:'🥟', kr:'비취 삼선 해물탕', local:'翡翠三鮮湯', py:'fěicuì sānxiāntāng'},
    {id:'houdefu_41', emoji:'🥟', kr:'새우 훈툰(완탕)탕', local:'鮮蝦餛飩湯', py:'xiānxiā húntuntāng'},
    {id:'houdefu_42', emoji:'🥟', kr:'유부 얇은 당면탕', local:'油豆腐細粉湯', py:'yóudòufu xìfěntāng'},
    {id:'houdefu_43', emoji:'🥟', kr:'자차이 돼지고기채 탕', local:'榨菜肉絲湯', py:'zhàcài ròusītāng'},
    {id:'houdefu_44', emoji:'🥟', kr:'쏸라탕 (새콤매콤 수프, 소/대)', local:'酸辣湯', py:'suānlàtāng'},
    {id:'houdefu_45', emoji:'🥟', kr:'좁쌀죽', local:'小米粥', py:'xiǎomǐzhōu'},
    {id:'houdefu_46', emoji:'🥟', kr:'흰쌀밥', local:'白飯', py:'báifàn'},
    {id:'houdefu_47', emoji:'🥟', kr:'밑반찬 (반찬대에 놓인 접시 색상/가격별: 40/50/100 TWD)', local:'小菜', py:'xiǎocài'},
  ],
  gangyuan: [
    {id:'gangyuan_01', emoji:'🍜', kr:'우육 비빔면 (향원우육면 대표 시그니처 메뉴, 국물 없는 소고기 비빔면)', local:'牛肉拌麵', py:'niúròu bànmiàn'},
    {id:'gangyuan_02', emoji:'🍜', kr:'우육 탕면 (진하고 깊은 육수의 소고기 국물면)', local:'牛肉湯麵', py:'niúròu tāngmiàn'},
    {id:'gangyuan_03', emoji:'🍜', kr:'족발 비빔면 (부드럽고 쫄깃하게 조린 돼지 족발 비빔면)', local:'豬腳拌麵', py:'zhūjiǎo bànmiàn'},
    {id:'gangyuan_04', emoji:'🍜', kr:'족발 탕면 (족발이 고명으로 올라간 따뜻한 국물면)', local:'豬腳湯麵', py:'zhūjiǎo tāngmiàn'},
    {id:'gangyuan_05', emoji:'🍜', kr:'돼지고기채 비빔면 (얇게 채 썬 돼지고기 비빔면)', local:'肉絲拌麵', py:'ròusī bànmiàn'},
    {id:'gangyuan_06', emoji:'🍜', kr:'돼지고기채 탕면 (채 썬 돼지고기가 들어간 담백한 국물면)', local:'肉絲湯麵', py:'ròusī tāngmiàn'},
    {id:'gangyuan_07', emoji:'🍜', kr:'우육 건당면 (소고기 볶음/비빔 얇은 당면)', local:'牛肉乾冬粉', py:'niúròu gān dōngfěn'},
    {id:'gangyuan_08', emoji:'🍜', kr:'족발 건당면 (족발 비빔 얇은 당면)', local:'豬腳乾冬粉', py:'zhūjiǎo gān dōngfěn'},
    {id:'gangyuan_09', emoji:'🍜', kr:'돼지고기채 건당면 (돼지고기채 비빔 얇은 당면)', local:'肉絲乾冬粉', py:'ròusī gān dōngfěn'},
    {id:'gangyuan_10', emoji:'🍜', kr:'삼보 비빔면 (소고기·양·스지 등 3가지 부위가 들어간 모둠 비빔면)', local:'三寶拌麵', py:'sānbǎo bànmiàn'},
    {id:'gangyuan_11', emoji:'🍜', kr:'삼보 탕면 (3가지 부위가 듬뿍 들어간 모둠 국물면)', local:'三寶湯麵', py:'sānbǎo tāngmiàn'},
    {id:'gangyuan_12', emoji:'🍜', kr:'맑은 비빔면 (고기 없이 소스와 파로만 비벼 먹는 면)', local:'清拌麵', py:'qīngbànmiàn'},
    {id:'gangyuan_13', emoji:'🍜', kr:'맑은 국물면 (고기 고명 없는 담백한 국수)', local:'清湯麵', py:'qīngtāngmiàn'},
    {id:'gangyuan_14', emoji:'🍜', kr:'우육탕 (면 없이 소고기와 국물만 나오는 탕)', local:'牛肉湯', py:'niúròutāng'},
    {id:'gangyuan_15', emoji:'🍜', kr:'소고기 당면탕 (소고기와 얇은 당면이 들어간 국물 요리)', local:'牛肉冬粉湯', py:'niúròu dōngfěntāng'},
    {id:'gangyuan_16', emoji:'🍜', kr:'족발 당면탕 (돼지 족발과 당면이 들어간 국물 요리)', local:'豬腳冬粉湯', py:'zhūjiǎo dōngfěntāng'},
    {id:'gangyuan_17', emoji:'🍜', kr:'돼지고기채 당면탕 (채 썬 돼지고기와 당면 국물 요리)', local:'肉絲冬粉湯', py:'ròusī dōngfěntāng'},
  ],
  yaroujen: [
    {id:'yaroujen_01', emoji:'🦆', kr:'오리고기 덮밥 (야러우전 시그니처, 훈제/삶은 오리고기와 루러우 소스를 얹은 밥)', local:'鴨肉飯', py:'yāròufàn'},
    {id:'yaroujen_02', emoji:'🦆', kr:'루러우판 (돼지고기 다짐육 조림 덮밥)', local:'肉燥飯', py:'ròuzàofàn'},
    {id:'yaroujen_03', emoji:'🦆', kr:'오리고기 비빔 당면 (국물 없이 특제 소스에 비벼 먹는 얇은 당면)', local:'鴨肉冬粉(乾)', py:'yāròu dōngfěn (gān)'},
    {id:'yaroujen_04', emoji:'🦆', kr:'오리고기 당면탕 (맑고 깊은 오리 육수에 말아 나오는 얇은 당면)', local:'鴨肉冬粉(湯)', py:'yāròu dōngfěn (tāng)'},
    {id:'yaroujen_05', emoji:'🦆', kr:'기본 당면탕 (오리고기 없이 깔끔한 국물에 나오는 당면)', local:'冬粉湯', py:'dōngfěntāng'},
    {id:'yaroujen_06', emoji:'🦆', kr:'흰쌀밥', local:'白飯', py:'báifàn'},
    {id:'yaroujen_07', emoji:'🦆', kr:'오리고기 수육 접시 (인원수에 맞춰 썰어주는 쫄깃한 오리고기 단품)', local:'鴨肉切盤', py:'yāròu qiēpán'},
    {id:'yaroujen_08', emoji:'🦆', kr:'오리 다리 구이/수육 (부드럽고 쫄깃한 오리 넓적다리 부위)', local:'鴨腿', py:'yātǔi'},
    {id:'yaroujen_09', emoji:'🦆', kr:'모둠 내장 수육 (건식, 오리 염통·간·모래집·내장 데침 모둠)', local:'綜合下水(乾)', py:'zònghé xiàshuǐ (gān)'},
    {id:'yaroujen_10', emoji:'🦆', kr:'오리 곱창 데침 (오독오독 쫄깃한 식감의 데친 오리 내장)', local:'乾鴨腸', py:'gān yācháng'},
    {id:'yaroujen_11', emoji:'🦆', kr:'오리 똥집/모래집 데침 (아삭아삭하고 쫄깃한 식감)', local:'乾鴨胗', py:'gān yāzhēn'},
    {id:'yaroujen_12', emoji:'🦆', kr:'오리 염통과 간 데침 (고소하고 부드러운 내장 수육)', local:'乾鴨心肝', py:'gān yāxīngān'},
    {id:'yaroujen_13', emoji:'🦆', kr:'오리 찹쌀 선지 떡 (오리 피와 찹쌀을 굳혀 쪄낸 쫀득한 대만 전통 떡)', local:'鴨血 / 鴨米血', py:'yāxuè / yāmǐxuè'},
    {id:'yaroujen_14', emoji:'🦆', kr:'오리 비장 수육 (대만 특유의 부드러운 오리 내장 부위)', local:'鴨尺', py:'yāchǐ'},
    {id:'yaroujen_15', emoji:'🦆', kr:'데친 계절 채소 (마늘 간장 소스를 곁들인 나물/공심채 등)', local:'燙青菜', py:'tàng qīngcài'},
    {id:'yaroujen_16', emoji:'🦆', kr:'모둠 내장탕 (오리 모래집, 간, 염통, 곱창 등이 푸짐하게 들어간 맑은 생강탕)', local:'綜合下水湯', py:'zònghé xiàshuǐtāng'},
    {id:'yaroujen_17', emoji:'🦆', kr:'동채 오리탕 (절인 채소인 둥차이와 오리고기가 들어간 감칠맛 넘치는 탕)', local:'冬菜鴨湯', py:'dōngcài yātāng'},
    {id:'yaroujen_18', emoji:'🦆', kr:'오리 염통·간 탕 (부드러운 식감의 내장 맑은 탕)', local:'鴨心肝湯', py:'yāxīngāntāng'},
    {id:'yaroujen_19', emoji:'🦆', kr:'오리 모래집탕 (쫄깃한 똥집과 얇게 썬 생강채가 들어간 시원한 탕)', local:'鴨胗湯', py:'yāzhēntāng'},
    {id:'yaroujen_20', emoji:'🦆', kr:'오리 곱창탕 (아삭하고 쫄깃한 오리 내장 탕)', local:'鴨腸湯', py:'yāchángtāng'},
    {id:'yaroujen_21', emoji:'🦆', kr:'오리 찹쌀 선지탕 (쫀득한 미쉐가 들어간 든든한 국물)', local:'鴨米血湯', py:'yāmǐxuètāng'},
    {id:'yaroujen_22', emoji:'🦆', kr:'동채 어묵탕 (수제 생선완자가 들어간 맑은 국물)', local:'冬菜魚丸湯', py:'dōngcài yúwántāng'},
  ],
  xinglongju: [
    {id:'xinglongju_01', emoji:'🥯', kr:'왕 탕포 (흥륭거 최고 인기 메뉴, 양배추와 돼지고기 육즙이 듬뿍 든 왕만두)', local:'湯包', py:'tāngbāo'},
    {id:'xinglongju_02', emoji:'🥯', kr:'표고버섯 채소 왕만두 (채식 야채 왕만두)', local:'香菇菜包', py:'xiānggū càibāo'},
    {id:'xinglongju_03', emoji:'🥯', kr:'궈톄 (바삭하게 구운 군만두)', local:'鍋貼', py:'guōtiē'},
    {id:'xinglongju_04', emoji:'🥯', kr:'수전포 (밑은 바삭하고 위는 촉촉하게 찐 군만두)', local:'水煎包', py:'shuǐjiānbāo'},
    {id:'xinglongju_05', emoji:'🥯', kr:'기본 샤오빙 (바삭하고 고소한 깨가 뿌려진 구운 빵 단품)', local:'燒餅', py:'shāobǐng'},
    {id:'xinglongju_06', emoji:'🥯', kr:'요우티아오 (바삭하게 튀겨낸 대만식 전통 꽈배기 도넛)', local:'油條', py:'yóutiáo'},
    {id:'xinglongju_07', emoji:'🥯', kr:'샤오빙 요우티아오 (바삭한 샤오빙 빵 속에 요우티아오를 끼워 먹는 정통 조합)', local:'燒餅油條', py:'shāobǐng yóutiáo'},
    {id:'xinglongju_08', emoji:'🥯', kr:'샤오빙 파계란 (샤오빙에 고소한 쪽파 달걀부침을 끼운 메뉴)', local:'燒餅蔥蛋', py:'shāobǐng cōngdàn'},
    {id:'xinglongju_09', emoji:'🥯', kr:'샤오빙 계란후라이 샌드', local:'燒餅荷包蛋', py:'shāobǐng hébāodàn'},
    {id:'xinglongju_10', emoji:'🥯', kr:'샤오빙 햄계란 샌드', local:'燒餅火腿蛋', py:'shāobǐng huǒtǔidàn'},
    {id:'xinglongju_11', emoji:'🥯', kr:'샤오빙 양상추 샌드 (신선한 양상추와 마요네즈가 들어간 아삭한 조합)', local:'燒餅生菜', py:'shāobǐng shēngcài'},
    {id:'xinglongju_12', emoji:'🥯', kr:'샤오빙 단빙 (바삭한 샤오빙 안에 쫄깃한 딴빙을 넣은 조합)', local:'燒餅蛋餅', py:'shāobǐng dànbǐng'},
    {id:'xinglongju_13', emoji:'🥯', kr:'삼대동당 (샤오빙 + 파계란 + 요우티아오를 모두 합친 푸짐한 시그니처 샌드)', local:'三代同堂', py:'sāndài tóngtáng'},
    {id:'xinglongju_14', emoji:'🥯', kr:'사사여의 (샤오빙 + 갓절임 쏸차이 + 파계란 + 요우티아오 종합 세트)', local:'事事如意', py:'shìshì rúyì'},
    {id:'xinglongju_15', emoji:'🥯', kr:'기본 단빙 (대만식 계란 전병/크레페)', local:'原味蛋餅', py:'yuánwèi dànbǐng'},
    {id:'xinglongju_16', emoji:'🥯', kr:'쪽파 달걀부침 (단품)', local:'蔥蛋', py:'cōngdàn'},
    {id:'xinglongju_17', emoji:'🥯', kr:'달걀후라이 (단품)', local:'荷包蛋', py:'hébāodàn'},
    {id:'xinglongju_18', emoji:'🥯', kr:'무떡 (대만 명절 및 조식 필수 무전병 구이)', local:'蘿蔔糕', py:'luóbogāo'},
    {id:'xinglongju_19', emoji:'🥯', kr:'판투안 (찹쌀밥 안에 요우티아오와 루러우 등을 넣은 대만식 주먹밥)', local:'飯糰', py:'fàntuán'},
    {id:'xinglongju_20', emoji:'🥯', kr:'과바오 (대만식 돼지고기 버거, 삼겹살 조림과 땅콩가루·쏸차이 샌드)', local:'割包 (刈包)', py:'guàbāo'},
  ],
  laojiang: [
    {id:'laojiang_12', emoji:'🍞', kr:'햄계란 토스트 (노강 대표 베스트셀러, 수입 버터 듬뿍 + 햄 + 반숙 달걀 + 후추)', local:'火腿蛋吐司', py:'huǒtǔidàn tǔsī'},
    {id:'laojiang_13', emoji:'🍞', kr:'불고기/바비큐 돼지고기 계란 토스트', local:'燒肉蛋吐司', py:'shāoròudàn tǔsī'},
    {id:'laojiang_14', emoji:'🍞', kr:'로우송 계란 토스트 (달콤짭조름한 돼지고기 보푸라기 플로스 + 계란)', local:'肉鬆蛋吐司', py:'ròusōngdàn tǔsī'},
    {id:'laojiang_15', emoji:'🍞', kr:'치즈 계란 토스트', local:'起司蛋吐司', py:'qǐsīdàn tǔsī'},
    {id:'laojiang_16', emoji:'🍞', kr:'에그 샐러드 토스트 (부드러운 삶은 달걀 마요네즈 샌드)', local:'蛋沙拉吐司', py:'dànshālā tǔsī'},
    {id:'laojiang_17', emoji:'🍞', kr:'참치 계란 토스트', local:'鮪魚蛋吐司', py:'wěiyúdàn tǔsī'},
    {id:'laojiang_18', emoji:'🍞', kr:'베이컨 계란 토스트', local:'培根蛋吐司', py:'péigēndàn tǔsī'},
    {id:'laojiang_19', emoji:'🍞', kr:'해시브라운 계란 토스트', local:'薯餅蛋吐司', py:'shǔbǐngdàn tǔsī'},
    {id:'laojiang_20', emoji:'🍞', kr:'로우송 햄계란 토스트 (푸짐한 콤보 토스트)', local:'肉鬆火腿蛋吐司', py:'ròusōng huǒtǔidàn tǔsī'},
    {id:'laojiang_21', emoji:'🍞', kr:'슈가/설탕 버터 토스트 (달콤하고 바삭하게 구운 토스트)', local:'糖霜吐司', py:'tángshuāng tǔsī'},
    {id:'laojiang_22', emoji:'🍞', kr:'잼 스프레드 토스트 (딸기·땅콩·버터·초콜릿 등 선택)', local:'抹醬吐司', py:'mǒjiàng tǔsī'},
    {id:'laojiang_23', emoji:'🍞', kr:'오리지널 단빙 (겉은 바삭하고 속은 쫄깃한 대만식 계란 전병)', local:'原味蛋餅', py:'yuánwèi dànbǐng'},
    {id:'laojiang_24', emoji:'🍞', kr:'불고기 단빙 (양념 돼지고기구이가 들어간 단빙)', local:'燒肉蛋餅', py:'shāoròu dànbǐng'},
    {id:'laojiang_25', emoji:'🍞', kr:'햄 단빙', local:'火腿蛋餅', py:'huǒtǔi dànbǐng'},
    {id:'laojiang_26', emoji:'🍞', kr:'치즈 단빙', local:'起司蛋餅', py:'qǐsī dànbǐng'},
    {id:'laojiang_27', emoji:'🍞', kr:'로우송(돼지고기 플로스) 단빙', local:'肉鬆蛋餅', py:'ròusōng dànbǐng'},
    {id:'laojiang_28', emoji:'🍞', kr:'참치 단빙', local:'鮪魚蛋餅', py:'wěiyú dànbǐng'},
    {id:'laojiang_29', emoji:'🍞', kr:'옥수수 콘 단빙', local:'玉米蛋餅', py:'yùmǐ dànbǐng'},
    {id:'laojiang_30', emoji:'🍞', kr:'베이컨 단빙', local:'培根蛋餅', py:'péigēn dànbǐng'},
    {id:'laojiang_31', emoji:'🍞', kr:'에그타르트 (카운터 쇼케이스의 인기 디저트)', local:'蛋塔', py:'dàntǎ'},
    {id:'laojiang_32', emoji:'🍞', kr:'녹두빵 / 녹두 모찌(찹쌀떡)', local:'綠豆椪 / 綠豆麻糬', py:'lǜdòupèng / lǜdòumáchǐ'},
    {id:'laojiang_33', emoji:'🍞', kr:'타이양빙 (대만식 전통 태양 전병 파이)', local:'太陽餅', py:'tàiyángbǐng'},
    {id:'laojiang_34', emoji:'🍞', kr:'호피 롤케이크 (호랑이 가죽 무늬의 부드러운 스펀지 롤케이크)', local:'虎皮蛋糕', py:'hǔpí dàngāo'},
    {id:'laojiang_35', emoji:'🍞', kr:'오뎅 튀김 (겉바속쫄 대만 남부식 어묵 튀김 칩)', local:'黑輪片 / 酥炸黑輪', py:'hēilúnpiàn / sūzhà hēilún'},
    {id:'laojiang_36', emoji:'🍞', kr:'샤오러우더우 (대만 남부 조식 명물 미니 소시지 팝)', local:'小肉豆', py:'xiǎoròudòu'},
    {id:'laojiang_37', emoji:'🍞', kr:'치킨너겟', local:'雞塊', py:'jīkuài'},
  ],
  dandan: [
    {id:'dandan_01', emoji:'🍔', kr:'크리스피 프라이드 치킨 (닭다리 雞腿 또는 허벅지살 雞塊 선택 / 매운맛·오리지널)', local:'脆皮炸雞', py:'cuìpí zhájī'},
    {id:'dandan_02', emoji:'🍔', kr:'크리스피 치킨통다리살 버거 (단단한보 부동의 1위 대표 버거, 매운맛 辣味 / 오리지널 原味)', local:'鮮脆雞腿堡', py:'xiāncuì jītuǐbǎo'},
    {id:'dandan_03', emoji:'🍔', kr:'바비큐 소스 치킨버거 (달콤짭조름한 특제 구이 소스)', local:'烤醬雞堡', py:'kǎojiàng jībǎo'},
    {id:'dandan_04', emoji:'🍔', kr:'데리야키 돈까스 버거 (돈육 패티와 양배추 채)', local:'照燒豬排堡', py:'zhàoshāo zhūpáibǎo'},
    {id:'dandan_05', emoji:'🍔', kr:'바삭 찹쌀 핫도그 바 (단단한보 명물 튀긴 찹쌀 핫바)', local:'香酥米糕', py:'xiāngsū mǐgāo'},
    {id:'dandan_06', emoji:'🍔', kr:'오곡 돼지고기 살코기 죽 (육수가 깊은 아침·세트 인기 죽)', local:'五穀瘦肉粥', py:'wǔgǔ shòuròuzhōu'},
    {id:'dandan_07', emoji:'🍔', kr:'고기완자 걸쭉 미엔셴 국수 (가쓰오부시 풍미의 달콤걸쭉한 대만식 대창/고기 국수)', local:'赤肉麵線羹', py:'chìròu miànxiàngēng'},
    {id:'dandan_08', emoji:'🍔', kr:'모찌 스틱 (흑당 소스에 찍어 먹는 겉바속쫀 찹쌀 떡 튀김)', local:'麻糬棒', py:'máshǔbàng'},
    {id:'dandan_09', emoji:'🍔', kr:'롱 소시지 (길쭉한 핫도그 소시지)', local:'超長熱狗', py:'chāocháng règǒu'},
    {id:'dandan_10', emoji:'🍔', kr:'고기 국수羹 + 크리스피 치킨 1조각 + 음료', local:'1號餐 (赤肉麵線羹 + 炸雞 (腿/塊))', py:'chìròu miànxiàngēng + zhájī'},
    {id:'dandan_11', emoji:'🍔', kr:'고기 국수羹 + 찹쌀 핫바 + 음료', local:'2號餐 (赤肉麵線羹 + 香酥米糕)', py:'chìròu miànxiàngēng + xiāngsū mǐgāo'},
    {id:'dandan_12', emoji:'🍔', kr:'고기 국수羹 + 모찌 스틱 + 음료', local:'3號餐 (赤肉麵線羹 + 麻糬棒)', py:'chìròu miànxiàngēng + máshǔbàng'},
    {id:'dandan_13', emoji:'🍔', kr:'오곡 고기죽 + 크리스피 치킨텐더 + 음료', local:'4號餐 (五穀瘦肉粥 + 脆皮雞柳)', py:'wǔgǔ shòuròuzhōu + cuìpí jīliǔ'},
    {id:'dandan_14', emoji:'🍔', kr:'크리스피 치킨통다리살 버거 + 콘스프 + 음료', local:'5號餐 (鮮脆雞腿堡 + 玉米濃湯)', py:'xiāncuì jītuǐbǎo + yùmǐ nóngtāng'},
    {id:'dandan_15', emoji:'🍔', kr:'바비큐 소스 치킨버거 + 콘스프 + 음료', local:'6號餐 (烤醬雞堡 + 玉米濃湯)', py:'kǎojiàng jībǎo + yùmǐ nóngtāng'},
    {id:'dandan_16', emoji:'🍔', kr:'바비큐 치킨버거 + 크리스피 치킨 1조각 + 음료', local:'7號餐 (烤醬雞堡 + 炸雞 (腿/塊))', py:'kǎojiàng jībǎo + zhájī'},
    {id:'dandan_17', emoji:'🍔', kr:'크리스피 치킨통다리살 버거 + 모찌 스틱 + 음료', local:'8號餐 (鮮脆雞腿堡 + 麻糬棒)', py:'xiāncuì jītuǐbǎo + máshǔbàng'},
    {id:'dandan_18', emoji:'🍔', kr:'[인기 1위] 고기 국수羹 + 크리스피 치킨통다리살 버거 + 음료', local:'9號餐 (赤肉麵線羹 + 鮮脆雞腿堡)', py:'chìròu miànxiàngēng + xiāncuì jītuǐbǎo'},
    {id:'dandan_19', emoji:'🍔', kr:'크리스피 치킨 1조각 + 치킨텐더 + 음료 (치킨 매니아용)', local:'10號餐 (炸雞 (腿/塊) + 脆皮雞柳)', py:'zhájī + cuìpí jīliǔ'},
    {id:'dandan_20', emoji:'🍔', kr:'고기 국수羹 + 데리야키 돈까스 버거 + 음료', local:'11號餐 (赤肉麵線羹 + 照燒豬排堡)', py:'chìròu miànxiàngēng + zhàoshāo zhūpáibǎo'},
    {id:'dandan_21', emoji:'🍔', kr:'[인기 2위] 오곡 고기죽 + 크리스피 치킨통다리살 버거 + 음료', local:'12號餐 (五穀瘦肉粥 + 鮮脆雞腿堡)', py:'wǔgǔ shòuròuzhōu + xiāncuì jītuǐbǎo'},
    {id:'dandan_22', emoji:'🍔', kr:'크리스피 치킨통다리살 버거 + 찹쌀 핫바 + 음료', local:'13號餐 (鮮脆雞腿堡 + 香酥米糕)', py:'xiāncuì jītuǐbǎo + xiāngsū mǐgāo'},
    {id:'dandan_23', emoji:'🍔', kr:'데리야키 돈까스 버거 + 크리스피 치킨 1조각 + 음료', local:'14號餐 (照燒豬排堡 + 炸雞 (腿/塊))', py:'zhàoshāo zhūpáibǎo + zhájī'},
    {id:'dandan_24', emoji:'🍔', kr:'콘스프 (옥수수와 게살 알갱이가 든 달콤부드러운 대만식 옥수수 수프)', local:'玉米濃湯', py:'yùmǐ nóngtāng'},
    {id:'dandan_25', emoji:'🍔', kr:'크리스피 치킨 텐더 (바삭한 안심 텐더 튀김)', local:'脆皮雞柳', py:'cuìpí jīliǔ'},
    {id:'dandan_26', emoji:'🍔', kr:'찹쌀 바 (대만 전통 찹쌀밥 튀김)', local:'香酥米糕', py:'xiāngsū mǐgāo'},
    {id:'dandan_27', emoji:'🍔', kr:'흑당 모찌 스틱 (달콤한 흑설탕 시럽을 찍어 먹는 찰떡 튀김)', local:'黑糖麻糬棒', py:'hēitáng máshǔbàng'},
    {id:'dandan_28', emoji:'🍔', kr:'고구마 튀김 (단단한보 특유의 달콤하고 굵은 고구마 감자튀김)', local:'地瓜薯條', py:'dìguā shǔtiáo'},
    {id:'dandan_29', emoji:'🍔', kr:'롱 소시지 (단품)', local:'超長熱狗', py:'chāocháng règǒu'},
    {id:'dandan_30', emoji:'🍔', kr:'순살 치킨너겟 (5조각)', local:'無骨雞塊', py:'wúgǔ jīkuài'},
  ],
  huada: [
    {id:'huada_18', emoji:'🧋', kr:'펄(타피오카 버블) 추가 (화달내차의 펄은 흑당 향이 감돌며 매우 쫄깃함, 보통 5 TWD)', local:'加珍珠', py:'jiā zhēnzhū'},
    {id:'huada_19', emoji:'🧋', kr:'티 젤리(차 푸딩) 추가 (탱글탱글 씹히는 은은한 차 젤리)', local:'加茶凍', py:'jiā chádòng'},
  ],
  dingtaifeng: [
    {id:'dingtaifeng_01', emoji:'🥟', kr:'샤오롱바오 (딘타이펑 시그니처 1위, 풍부한 돼지고기 육즙의 탕포)', local:'小籠包', py:'xiǎolóngbāo'},
    {id:'dingtaifeng_02', emoji:'🥟', kr:'게살 돼지고기 샤오롱바오', local:'蟹粉小籠包', py:'xièfěn xiǎolóngbāo'},
    {id:'dingtaifeng_03', emoji:'🥟', kr:'수세미오이 새우 샤오롱바오 (담백하고 채즙이 풍부한 깔끔한 맛)', local:'絲瓜蝦仁小籠包', py:'sīguā xiārén xiǎolóngbāo'},
    {id:'dingtaifeng_04', emoji:'🥟', kr:'트러플 샤오롱바오 (송로버섯 향이 진하게 퍼지는 프리미엄 만두)', local:'松露小籠包', py:'sōnglù xiǎolóngbāo'},
    {id:'dingtaifeng_05', emoji:'🥟', kr:'새우 돼지고기 찐만두', local:'蝦肉蒸餃', py:'xiāròu zhēngjiǎo'},
    {id:'dingtaifeng_06', emoji:'🥟', kr:'돼지고기 찐만두', local:'鮮肉蒸餃', py:'xiānròu zhēngjiǎo'},
    {id:'dingtaifeng_07', emoji:'🥟', kr:'채식 야채 찐만두 (청경채, 버섯, 당면 등이 든 깔끔한 찐만두)', local:'花素蒸餃', py:'huāsù zhēngjiǎo'},
    {id:'dingtaifeng_08', emoji:'🥟', kr:'새우 돼지고기 샤오마이 (위에 통새우가 올라간 오픈형 딤섬)', local:'蝦肉燒賣', py:'xiāròu shàomài'},
    {id:'dingtaifeng_09', emoji:'🥟', kr:'찹쌀 샤오마이 (돼지고기 향미유로 볶은 찰밥이 든 샤오마이)', local:'糯肉燒賣', py:'nuòròu shàomài'},
    {id:'dingtaifeng_10', emoji:'🥟', kr:'매콤한 오이김치 (고추기름과 마늘로 버무린 딘타이펑 필수 오이 전채)', local:'辣味黃瓜', py:'làwèi huángguā'},
    {id:'dingtaifeng_11', emoji:'🥟', kr:'오향 특제 반찬 (미역줄기, 숙주나물, 두부건, 당면을 새콤고소하게 무친 요리)', local:'小菜', py:'xiǎocài'},
    {id:'dingtaifeng_12', emoji:'🥟', kr:'줄기콩 볶음 (돼지고기 다짐육과 함께 센 불에 볶아낸 껍질콩)', local:'乾煸四季豆', py:'gānbiān sìjìdòu'},
    {id:'dingtaifeng_13', emoji:'🥟', kr:'카오푸 (스펀지 식감의 밀 글루텐과 목이버섯, 죽순 간장 조림)', local:'烤麩', py:'kǎofū'},
    {id:'dingtaifeng_14', emoji:'🥟', kr:'소흥 취계 (샤오싱 전통주에 재워 차갑게 식힌 부드러운 닭고기 냉채)', local:'紹興醉雞', py:'shàoxīng zuìjī'},
    {id:'dingtaifeng_15', emoji:'🥟', kr:'갈비 튀김 계란 볶음밥 (두툼하고 부드러운 대만식 돼지갈비 튀김이 올라간 1위 볶음밥)', local:'排骨蛋炒飯', py:'páigǔ dàn chǎofàn'},
    {id:'dingtaifeng_16', emoji:'🥟', kr:'새우 계란 볶음밥 (탱글탱글한 알새우가 듬뿍 들어간 고슬고슬한 볶음밥)', local:'蝦仁蛋炒飯', py:'xiārén dàn chǎofàn'},
    {id:'dingtaifeng_17', emoji:'🥟', kr:'돼지고기채 계란 볶음밥', local:'肉絲蛋炒飯', py:'ròusī dàn chǎofàn'},
    {id:'dingtaifeng_18', emoji:'🥟', kr:'기본 계란 볶음밥 (파와 계란으로만 볶아낸 깔끔한 볶음밥)', local:'蛋炒飯', py:'dàn chǎofàn'},
    {id:'dingtaifeng_19', emoji:'🥟', kr:'매콤한 새우 돼지고기 비빔만두 (특제 고추기름 소스에 비벼 먹는 인기 완탕)', local:'紅油抄手(蝦肉)', py:'hóngyóu chāoshǒu (xiāròu)'},
    {id:'dingtaifeng_20', emoji:'🥟', kr:'매콤한 채소 돼지고기 비빔만두', local:'紅油抄手(菜肉)', py:'hóngyóu chāoshǒu (càiròu)'},
    {id:'dingtaifeng_21', emoji:'🥟', kr:'홍샤오 우육면 (진하고 깊은 국물의 대만식 소고기 탕면, 힘줄/고기 선택 가능)', local:'紅燒牛肉麵', py:'hóngshāo niúròumiàn'},
    {id:'dingtaifeng_22', emoji:'🥟', kr:'칭탕 우육면 (맑고 담백한 육수의 소고기 탕면)', local:'清湯牛肉麵', py:'qīngtāng niúròumiàn'},
    {id:'dingtaifeng_23', emoji:'🥟', kr:'탄탄면 (땅콩 소스와 참깨의 고소함, 매콤함이 어우러진 비빔면)', local:'擔擔麵', py:'dàndànmiàn'},
    {id:'dingtaifeng_24', emoji:'🥟', kr:'간판면 (파기름과 특제 간장에 심플하게 비벼 먹는 국수)', local:'乾拌麵', py:'gānbànmiàn'},
    {id:'dingtaifeng_25', emoji:'🥟', kr:'자장면 (두부와 돼지고기를 볶은 춘장 소스 비빔면)', local:'炸醬麵', py:'zhájiàngmiàn'},
    {id:'dingtaifeng_26', emoji:'🥟', kr:'원충 닭고기 맑은 탕 (오랜 시간 정성껏 우려낸 맑고 깊은 보양 닭육수)', local:'元盅雞湯', py:'yuánzhōng jītāng'},
    {id:'dingtaifeng_27', emoji:'🥟', kr:'원충 소고기 맑은 탕 (부드러운 소고기 덩어리가 든 맑은 보양 탕)', local:'元盅牛肉湯', py:'yuánzhōng niúròutāng'},
    {id:'dingtaifeng_28', emoji:'🥟', kr:'쏸라탕 (두부, 죽순, 버섯 등이 들어간 새콤매콤한 대만식 전통 수프)', local:'酸辣湯', py:'suānlàtāng'},
    {id:'dingtaifeng_29', emoji:'🥟', kr:'새우 완탕 스프 (맑은 국물에 부드러운 새우 훈툰이 든 탕)', local:'蝦肉餛飩湯', py:'xiāròu húntuntāng'},
    {id:'dingtaifeng_30', emoji:'🥟', kr:'초콜릿 샤오롱바오 (쫀득한 피 속에 진한 수제 초콜릿 가나슈가 든 디저트)', local:'巧克力小籠包', py:'qiǎokèlì xiǎolóngbāo'},
    {id:'dingtaifeng_31', emoji:'🥟', kr:'팥소 샤오롱바오 (곱게 갈아낸 달콤한 팥 앙금이 든 만두)', local:'豆沙小籠包', py:'dòushā xiǎolóngbāo'},
    {id:'dingtaifeng_32', emoji:'🥟', kr:'토란(타로) 샤오롱바오 (부드럽고 달콤고소한 타로 무스가 든 만두)', local:'芋泥小籠包', py:'yùní xiǎolóngbāo'},
    {id:'dingtaifeng_33', emoji:'🥟', kr:'황금 유사포 (반을 가르면 달콤짭조름한 커스터드 노른자 크림이 흘러나오는 찐빵)', local:'黃金流沙包', py:'huángjīn liúshābāo'},
  ],
  haizhibing: [
    {id:'haizhibing_01', emoji:'🍧', kr:'일반 얼음 빙수 (시원하고 아삭아삭 씹히는 전통 간 얼음)', local:'剉冰', py:'cuòbīng'},
    {id:'haizhibing_02', emoji:'🍧', kr:'눈꽃 빙수 (우유를 곱고 부드럽게 갈아낸 밀크 눈꽃 얼음)', local:'雪花冰', py:'xuěhuābīng'},
    {id:'haizhibing_03', emoji:'🍧', kr:'종합 과일 빙수 (해지빙 부동의 1위 대표 메뉴, 수박·메론·바나나 등 제철 생과일 모둠)', local:'水果冰', py:'shuǐguǒ bīng'},
    {id:'haizhibing_04', emoji:'🍧', kr:'망고 빙수 (여름 한정 시즌 대표 메뉴, 생망고 듬뿍)', local:'芒果冰', py:'mángguǒ bīng'},
    {id:'haizhibing_05', emoji:'🍧', kr:'딸기 빙수 (겨울~봄 한정 시즌 메뉴, 생딸기 토핑)', local:'草莓冰', py:'cǎoméi bīng'},
    {id:'haizhibing_06', emoji:'🍧', kr:'바나나 초콜릿 빙수 (생바나나와 진한 초콜릿 시럽 조합)', local:'香蕉巧克力冰', py:'xiāngjiāo qiǎokèlì bīng'},
    {id:'haizhibing_07', emoji:'🍧', kr:'레몬 빙수 (상큼하고 깔끔한 생레몬 시럽 빙수)', local:'檸檬冰', py:'níngméng bīng'},
    {id:'haizhibing_08', emoji:'🍧', kr:'패션후르츠 빙수 (새콤달콤한 백향과 청 토핑 빙수)', local:'百香果冰', py:'bǎixiāngguǒ bīng'},
    {id:'haizhibing_09', emoji:'🍧', kr:'팔보 빙수 (팥, 율무, 젤리, 타로볼 등 8가지 전통 고명이 들어간 종합 빙수)', local:'八寶冰', py:'bābǎobīng'},
    {id:'haizhibing_10', emoji:'🍧', kr:'팥 우유(연유) 빙수 (달콤하게 삶은 단팥과 연유를 듬뿍 얹은 기본 팥빙수)', local:'紅豆牛奶冰', py:'hóngdòu niúnǎi bīng'},
    {id:'haizhibing_11', emoji:'🍧', kr:'토란(타로) 연유 빙수 (달착지근하고 부드럽게 조린 타로 덩어리 토핑)', local:'芋頭牛奶冰', py:'yùtou niúnǎi bīng'},
    {id:'haizhibing_12', emoji:'🍧', kr:'녹두 연유 빙수 (고소하고 부드러운 녹두 토핑)', local:'綠豆牛奶冰', py:'lǜdòu niúnǎi bīng'},
    {id:'haizhibing_13', emoji:'🍧', kr:'땅콩 연유 빙수 (부드럽게 푹 삶아낸 대만 전통 삷은 땅콩)', local:'花生牛奶冰', py:'huāshēng niúnǎi bīng'},
    {id:'haizhibing_14', emoji:'🍧', kr:'푸딩 연유 빙수 (달콤한 커스터드 푸딩을 통째로 올린 빙수)', local:'布丁牛奶冰', py:'bùdīng niúnǎi bīng'},
    {id:'haizhibing_15', emoji:'🍧', kr:'선초(시엔차오) 젤리 빙수 (쌉싸름하고 개운한 대만 전통 약초 허브 젤리)', local:'仙草冰', py:'xiāncǎo bīng'},
    {id:'haizhibing_16', emoji:'🍧', kr:'아이위 젤리 빙수 (대만 고유 야생 열매로 만든 산뜻한 레몬 젤리 빙수)', local:'愛玉冰', py:'àiyù bīng'},
    {id:'haizhibing_23', emoji:'🍧', kr:'통 푸딩 추가', local:'加布丁', py:'jiā bùdīng'},
    {id:'haizhibing_24', emoji:'🍧', kr:'아이스크림 1스쿱 추가', local:'加冰淇淋', py:'jiā bīngqílín'},
    {id:'haizhibing_25', emoji:'🍧', kr:'연유 추가', local:'加煉乳', py:'jiā liànrǔ'},
    {id:'haizhibing_26', emoji:'🍧', kr:'타피오카 펄 추가', local:'加珍珠', py:'jiā zhēnzhū'},
    {id:'haizhibing_27', emoji:'🍧', kr:'위위안(쫄깃한 타로·고구마 경단) 추가', local:'加芋圓', py:'jiā yùyuán'},
  ],
  zhenglaopai: [

  ],
  tianshi: [
    {id:'tianshi_01', emoji:'🍗', kr:'천사 지파이 - 오리지널 맛 (달콤짭조름한 특제 파우더와 두툼하고 풍부한 육즙의 대표 지파이)', local:'天使雞排 (原味)', py:'tiānshǐ jīpái (yuánwèi)'},
    {id:'tianshi_02', emoji:'🍗', kr:'천사 지파이 - 매운맛 (특제 매운 고춧가루 파우더를 뿌려 느끼함을 잡아주는 인기 맛)', local:'天使雞排 (香辣)', py:'tiānshǐ jīpái (xiānglà)'},
    {id:'tianshi_03', emoji:'🍗', kr:'천사 지파이 - 후추소금맛 (대만 전통 옌쑤지 풍미의 짭짤하고 향긋한 후추소금 시즈닝)', local:'天使雞排 (椒鹽)', py:'tiānshǐ jīpái (jiāoyán)'},
    {id:'tianshi_04', emoji:'🍗', kr:'불타는 매운 지파이 (강한 매운맛을 선호하는 분들을 위한 고강도 매운 시즈닝 지파이)', local:'火辣雞排', py:'huǒlà jīpái'},
    {id:'tianshi_05', emoji:'🍗', kr:'수제 톈부라 (대만식 어묵 튀김, 겉은 파삭하고 속은 쫄깃한 식감의 인기 간식)', local:'手工甜不辣', py:'shǒugōng tiánbùlà'},
    {id:'tianshi_06', emoji:'🍗', kr:'크리스피 백엽두부 (백엽두부를 바삭하게 튀겨내어 겉바속촉 쫀득한 두부 튀김)', local:'酥脆百頁豆腐', py:'sūcuì bǎiyè dòufu'},
    {id:'tianshi_07', emoji:'🍗', kr:'크리스피 팽이버섯 튀김 (팽이버섯을 통째로 바삭하게 튀겨 스낵처럼 먹는 별미)', local:'脆皮金針菇', py:'cuìpí jīnzhēngū'},
    {id:'tianshi_08', emoji:'🍗', kr:'줄기콩 튀김 (기름에 살짝 튀겨 후추소금에 버무린 달콤아삭한 그린빈스)', local:'四季豆', py:'sìjìdòu'},
    {id:'tianshi_09', emoji:'🍗', kr:'새송이버섯 튀김 (한 입 베어 물면 버섯 채즙이 팡 터지는 인기 튀김)', local:'杏鮑菇', py:'xìngbàogū'},
    {id:'tianshi_10', emoji:'🍗', kr:'미쉐가오 (대만 전통 찹쌀 선지 떡 튀김, 겉은 바삭하고 속은 찰진 식감)', local:'米血糕', py:'mǐxuègāo'},
    {id:'tianshi_11', emoji:'🍗', kr:'감자튀김 / 대만식 고구마 튀김', local:'脆薯 / 地瓜薯條', py:'cuìshǔ / dìguā shǔtiáo'},
    {id:'tianshi_12', emoji:'🍗', kr:'안 매운맛 (매운 가루 없음, 오리지널 시즈닝만 적용)', local:'不辣', py:'bù là'},
    {id:'tianshi_13', emoji:'🍗', kr:'신라면보다 덜 매운 은은한 맛 (약간의 매콤함으로 감칠맛 증가, 추천)', local:'微辣', py:'wēi là'},
    {id:'tianshi_14', emoji:'🍗', kr:'보통 매운맛 (한국인 기준 맛있게 매콤한 정도, 신라면 수준)', local:'小辣', py:'xiǎo là'},
    {id:'tianshi_15', emoji:'🍗', kr:'중간 매운맛 (청양고추 수준의 제법 매운맛)', local:'中辣', py:'zhōng là'},
    {id:'tianshi_16', emoji:'🍗', kr:'아주 매운맛 (불닭볶음면 수준의 강렬한 매운맛)', local:'大辣', py:'dà là'},
  ],
};

const RESTAURANT_DRINK = {
  houdefu: [

  ],
  gangyuan: [
    {id:'gangyuan_18', emoji:'🍜', kr:'오이무침 (마늘향 가득 새콤달콤 아삭한 대만식 필수 오이반찬)', local:'涼拌小黃瓜', py:'liángbàn xiǎohuángguā'},
    {id:'gangyuan_19', emoji:'🍜', kr:'황금 김치 (달콤새콤 부드러운 대만식 백채 김치)', local:'黃金泡菜', py:'huángjīn pàocài'},
    {id:'gangyuan_20', emoji:'🍜', kr:'조림 두부건 (짭짤하게 조린 말린 두부)', local:'滷豆乾', py:'lǔ dòugān'},
    {id:'gangyuan_21', emoji:'🍜', kr:'미역줄기/다시마채 무침', local:'海帶絲', py:'hǎidàisī'},
    {id:'gangyuan_22', emoji:'🍜', kr:'돼지 귀 무침 (오독오독한 식감의 전채 요리)', local:'豬耳朵', py:'zhū\'ěrduo'},
    {id:'gangyuan_23', emoji:'🍜', kr:'피단 두부 (삭힌 오리알과 연두부 간장 무침)', local:'皮蛋豆腐', py:'pídàn dòufu'},
    {id:'gangyuan_24', emoji:'🍜', kr:'모둠 조림 플래터 (소힘줄/스지 + 소위/양 수육 모둠)', local:'雙拼滷味', py:'shuāngpīn lǔwèi'},
    {id:'gangyuan_25', emoji:'🍜', kr:'소양 조림 (쫄깃한 벌집양/소위 수육)', local:'牛肚', py:'niúdù'},
    {id:'gangyuan_26', emoji:'🍜', kr:'소힘줄(스지) 조림 (콜라겐 가득 부드러운 스지 수육)', local:'牛筋', py:'niújīn'},
  ],
  yaroujen: [

  ],
  xinglongju: [
    {id:'xinglongju_21', emoji:'🥯', kr:'또우장 (고소한 대만식 콩국/두유)', local:'豆漿', py:'dòujiāng'},
    {id:'xinglongju_22', emoji:'🥯', kr:'셴또우장 (요우티아오·식초·고추기름·파 등을 넣어 순두부처럼 굳혀 먹는 짠 두유)', local:'鹹豆漿', py:'xiándòujiāng'},
    {id:'xinglongju_23', emoji:'🥯', kr:'미장 (쌀과 볶은 땅콩으로 끓여낸 달콤하고 고소한 미숫가루 음료)', local:'米漿', py:'mǐjiāng'},
    {id:'xinglongju_24', emoji:'🥯', kr:'또우장 홍차 (두유와 홍차 밀크티 조합)', local:'豆漿紅茶', py:'dòujiāng hóngchá'},
    {id:'xinglongju_25', emoji:'🥯', kr:'또우장 미장 (두유와 땅콩 쌀음료 반반 믹스)', local:'豆漿米漿', py:'dòujiāng mǐjiāng'},
    {id:'xinglongju_26', emoji:'🥯', kr:'고전 대만식 블랙티 (달콤한 홍차)', local:'紅茶', py:'hóngchá'},
    {id:'xinglongju_27', emoji:'🥯', kr:'생우유 홍차 (밀크티)', local:'鮮奶紅茶', py:'xiānnǎi hóngchá'},
    {id:'xinglongju_28', emoji:'🥯', kr:'배아 두유 (밀배아를 넣은 영양 두유)', local:'胚芽豆漿', py:'pēiyá dòujiāng'},
  ],
  laojiang: [
    {id:'laojiang_01', emoji:'🍞', kr:'홍차 우유 (노강의 부동의 1위 시그니처, 진한 훈제향 홍차 + 대만 고품질 생우유)', local:'紅茶牛奶', py:'hóngchá niúnǎi'},
    {id:'laojiang_02', emoji:'🍞', kr:'녹두 우유 (부드럽게 갈아낸 녹두와 생우유의 달콤고소한 조합)', local:'綠豆牛奶', py:'lǜdòu niúnǎi'},
    {id:'laojiang_03', emoji:'🍞', kr:'고전 훈제 홍차 (특유의 쌉싸름하고 깊은 향이 특징인 전통 대만식 블랙티)', local:'紅茶', py:'hóngchá'},
    {id:'laojiang_04', emoji:'🍞', kr:'녹두즙 (시원하고 깔끔하게 갈아낸 전통 녹두 음료)', local:'綠豆汁 / 綠豆露', py:'lǜdòuzhī / lǜdòulù'},
    {id:'laojiang_05', emoji:'🍞', kr:'로젤(히비스커스) 차 (새콤달콤하고 개운한 꽃차)', local:'洛神花茶', py:'luòshénhuāchá'},
    {id:'laojiang_06', emoji:'🍞', kr:'자스민 밀크티 (은은한 자스민 꽃향이 감도는 녹차 밀크티)', local:'茉香奶茶', py:'mòxiāng nǎichá'},
    {id:'laojiang_07', emoji:'🍞', kr:'녹차 (깔끔한 기본 그린티)', local:'綠茶', py:'lǜchá'},
    {id:'laojiang_08', emoji:'🍞', kr:'매실 녹차 (새콤한 매실 청을 더한 녹차)', local:'梅子綠茶', py:'méizi lǜchá'},
    {id:'laojiang_09', emoji:'🍞', kr:'야쿠르트 녹차 (달콤상큼한 야쿠르트와 녹차 조합)', local:'養樂多綠茶', py:'yǎnglèduō lǜchá'},
    {id:'laojiang_10', emoji:'🍞', kr:'블랙커피 (아메리카노)', local:'黑咖啡', py:'hēi kāfēi'},
    {id:'laojiang_11', emoji:'🍞', kr:'카페라떼', local:'咖啡拿鐵', py:'kāfēi nátiě'},
  ],
  dandan: [
    {id:'dandan_31', emoji:'🍔', kr:'아이스 홍차 우유 (단단한보 세트 음료 업그레이드 추천 1위)', local:'冰紅茶牛奶', py:'bīng hóngchá niúnǎi'},
    {id:'dandan_32', emoji:'🍔', kr:'아이스 커피 우유', local:'冰咖啡牛奶', py:'bīng kāfēi niúnǎi'},
    {id:'dandan_33', emoji:'🍔', kr:'대만 레몬 홍차', local:'台灣檸檬紅茶', py:'táiwān níngméng hóngchá'},
    {id:'dandan_34', emoji:'🍔', kr:'따뜻한 아메리카노', local:'美式熱咖啡', py:'měishì rè kāfēi'},
    {id:'dandan_35', emoji:'🍔', kr:'펩시 콜라', local:'百事可樂', py:'bǎishì kělè'},
    {id:'dandan_36', emoji:'🍔', kr:'세븐업 (사이다)', local:'七喜汽水', py:'qīxǐ qìshuǐ'},
    {id:'dandan_37', emoji:'🍔', kr:'립톤 레몬 아이스티', local:'檸檬風味紅茶', py:'níngméng fēngwèi hóngchá'},
    {id:'dandan_38', emoji:'🍔', kr:'따뜻한 밀크티', local:'熱奶茶', py:'rè nǎichá'},
  ],
  huada: [
    {id:'huada_01', emoji:'🧋', kr:'[정상 당도 (100% 甜)] 화달 밀크티 (화달의 시그니처 대표 메뉴. 홍차 베이스 + 생우유, 가장 달콤하고 진함)', local:'樺達奶茶', py:'huàdá nǎichá'},
    {id:'huada_02', emoji:'🧋', kr:'[반당 (약 50% 甜)] 미용 밀크티 (홍차 50% + 보이차 50% + 생우유, 과하지 않은 깔끔한 단맛으로 한국인 인기 1위)', local:'美容奶茶', py:'měiróng nǎichá'},
    {id:'huada_03', emoji:'🧋', kr:'[미당 (약 25% 甜)] 익수 밀크티 (보이차 50% + 홍차 50% + 생우유, 보이차 비율이 높아 은은하고 덜 단맛)', local:'益壽奶茶', py:'yìshòu nǎichá'},
    {id:'huada_04', emoji:'🧋', kr:'[무당 (0% 無糖)] 보이 밀크티 (100% 보이차 베이스 + 생우유, 단맛 없이 담백하고 구수한 밀크티)', local:'普洱奶茶', py:'pǔ\'ěr nǎichá'},
    {id:'huada_05', emoji:'🧋', kr:'[미당 (약 25% 甜)] 우롱 밀크티 (깊고 구수한 대만 고산 우롱차 + 생우유)', local:'烏龍奶茶', py:'wūlóng nǎichá'},
    {id:'huada_06', emoji:'🧋', kr:'[반당 (약 50% 甜)] 홍룡 밀크티 (홍차 + 우롱차 + 생우유 배합)', local:'紅龍奶茶', py:'hónglóng nǎichá'},
    {id:'huada_07', emoji:'🧋', kr:'[미당/반당] 그린 밀크티 (자스민 녹차 + 생우유, 산뜻하고 향긋한 맛)', local:'綠奶茶', py:'lǜ nǎichá'},
    {id:'huada_08', emoji:'🧋', kr:'[정상 당도] 화달 홍차 (전통 방식으로 우려낸 진하고 달콤한 대만식 블랙티)', local:'樺達紅茶', py:'huàdá hóngchá'},
    {id:'huada_09', emoji:'🧋', kr:'[무당 (無糖)] 보이차 (식후 깔끔하게 입가심하기 좋은 전통 구수한 보이차)', local:'普洱茶', py:'pǔ\'ěrchá'},
    {id:'huada_10', emoji:'🧋', kr:'[무당 (無糖)] 우롱차 (향긋하고 개운한 고산 우롱차)', local:'烏龍茶', py:'wūlóngchá'},
    {id:'huada_11', emoji:'🧋', kr:'[무당 (無糖)] 자스민 녹차 (산뜻하고 은은한 꽃향의 녹차)', local:'綠茶', py:'lǜchá'},
    {id:'huada_12', emoji:'🧋', kr:'[무당 / 미당] 굿모닝 홍차 (달지 않고 깔끔하게 아침에 마시기 좋은 깔끔한 홍차)', local:'早安紅茶', py:'zǎo\'ān hóngchá'},
    {id:'huada_13', emoji:'🧋', kr:'[새콤달콤] 레몬 홍차 (생레몬 원액이 들어가 상큼하고 깔끔한 아이스티)', local:'檸檬紅茶', py:'níngméng hóngchá'},
    {id:'huada_14', emoji:'🧋', kr:'[새콤달콤] 레몬 동과차 (달콤한 동과차에 생레몬을 더한 대만 대표 갈증해소 음료)', local:'檸檬冬瓜', py:'níngméng dōngguā'},
    {id:'huada_15', emoji:'🧋', kr:'[달콤함] 동과차 (전통 동과 설탕을 끓여낸 달착지근한 전통차)', local:'冬瓜茶', py:'dōngguāchá'},
    {id:'huada_16', emoji:'🧋', kr:'[달콤함] 동과 우유 (달콤한 동과차 베이스에 생우유를 섞은 고소달콤 밀크티)', local:'冬瓜牛奶', py:'dōngguānǎichá'},
    {id:'huada_17', emoji:'🧋', kr:'[새콤달콤] 산매탕 (훈제 오매 매실을 우려낸 시원하고 개운한 대만 전통 소화 음료)', local:'酸梅湯', py:'suānméitāng'},
  ],
  dingtaifeng: [

  ],
  haizhibing: [
    {id:'haizhibing_17', emoji:'🍧', kr:'종합 생과일 믹스 주스', local:'綜合果汁', py:'zònghé guǒzhī'},
    {id:'haizhibing_18', emoji:'🍧', kr:'파파야 우유 (대만 남부 필수 생과일 우유 주스)', local:'木瓜牛奶', py:'mùguā niúnǎi'},
    {id:'haizhibing_19', emoji:'🍧', kr:'생망고 주스', local:'芒果汁', py:'mángguǒzhī'},
    {id:'haizhibing_20', emoji:'🍧', kr:'수박 주스 (시원하고 달콤한 갈증 해소 주스)', local:'西瓜汁', py:'xīguāzhī'},
    {id:'haizhibing_21', emoji:'🍧', kr:'레몬 아이위 주스 (새콤달콤하고 말랑한 젤리가 든 전통 음료)', local:'檸檬愛玉', py:'níngméng àiyù'},
    {id:'haizhibing_22', emoji:'🍧', kr:'녹두 스무디 우유 (녹두를 곱게 갈아 만든 시원한 쉐이크)', local:'綠豆沙牛奶', py:'lǜdòushā niúnǎi'},
  ],
  zhenglaopai: [
    {id:'zhenglaopai_01', emoji:'🥛', kr:'파파야 우유 (정로패 대표 시그니처 1위, 완숙 파파야와 생우유의 달콤하고 녹진한 조화)', local:'木瓜牛奶', py:'mùguā niúnǎi'},
    {id:'zhenglaopai_02', emoji:'🥛', kr:'바나나 우유 (진하고 크리미한 생바나나 우유)', local:'香蕉牛奶', py:'xiāngjiāo niúnǎi'},
    {id:'zhenglaopai_03', emoji:'🥛', kr:'아보카도 우유 (대만 특유의 푸딩이나 꿀을 더해 고소하고 진한 아보카도 주스)', local:'酪梨牛奶', py:'luòlí niúnǎi'},
    {id:'zhenglaopai_04', emoji:'🥛', kr:'딸기 우유 (시즌 한정 생딸기 우유)', local:'草莓牛奶', py:'cǎoméi niúnǎi'},
    {id:'zhenglaopai_05', emoji:'🥛', kr:'수박 우유 (수박의 청량함과 우유의 부드러움이 어우러진 주스)', local:'西瓜牛奶', py:'xīguā niúnǎi'},
    {id:'zhenglaopai_06', emoji:'🥛', kr:'멜론(하미과) 우유 (달콤한 대만 멜론 우유)', local:'哈密瓜牛奶', py:'hāmìguā niúnǎi'},
    {id:'zhenglaopai_07', emoji:'🥛', kr:'망고 우유 (여름 시즌 대표 생망고 우유)', local:'芒果牛奶', py:'mángguǒ niúnǎi'},
    {id:'zhenglaopai_08', emoji:'🥛', kr:'수박 주스 (야시장 기름진 음식 후 마시기 좋은 청량한 100% 수박 착즙)', local:'西瓜汁', py:'xīguāzhī'},
    {id:'zhenglaopai_09', emoji:'🥛', kr:'대만 오렌지(류딩) 주스 (새콤달콤하고 과즙 풍부한 대만 토종 오렌지 착즙)', local:'柳丁汁', py:'liǔdīngzhī'},
    {id:'zhenglaopai_10', emoji:'🥛', kr:'레몬 주스 (상큼하고 깔끔한 생레몬 착즙 주스)', local:'檸檬汁', py:'níngméngzhī'},
    {id:'zhenglaopai_11', emoji:'🥛', kr:'구아바 주스 (대만 명물 녹색 구아바 생과일 주스)', local:'芭樂汁', py:'bālèzhī'},
    {id:'zhenglaopai_12', emoji:'🥛', kr:'여주 주스 (대만 백여주에 꿀을 넣어 쓴맛을 줄인 시원한 해열 건강 주스)', local:'苦瓜汁 / 白玉苦瓜汁', py:'kǔguāzhī / báiyù kǔguāzhī'},
    {id:'zhenglaopai_13', emoji:'🥛', kr:'종합 믹스 과일 주스 (다양한 제철 생과일을 함께 갈아낸 주스)', local:'綜合果汁', py:'zònghé guǒzhī'},
    {id:'zhenglaopai_14', emoji:'🥛', kr:'자몽 주스 (쌉싸름하고 달콤한 생자몽 주스)', local:'葡萄柚汁', py:'pútáoyòuzhī'},
    {id:'zhenglaopai_15', emoji:'🥛', kr:'금귤 레몬 주스 (새콤하고 비타민 가득한 대만 전통 음료)', local:'金桔檸檬', py:'jīnjú níngméng'},
    {id:'zhenglaopai_16', emoji:'🥛', kr:'레몬 홍차 (전통 훈제 홍차에 생레몬 과즙을 띄운 아이스티)', local:'檸檬紅茶', py:'níngméng hóngchá'},
    {id:'zhenglaopai_17', emoji:'🥛', kr:'동과차 (대만 전통 설탕수박 동과를 끓여낸 달콤한 전통차)', local:'冬瓜茶', py:'dōngguāchá'},
    {id:'zhenglaopai_18', emoji:'🥛', kr:'레몬 동과차 (달콤한 동과차와 새콤한 레몬의 완벽한 밸런스)', local:'冬瓜檸檬', py:'dōngguā níngméng'},
    {id:'zhenglaopai_19', emoji:'🥛', kr:'동과 우유 (달착지근한 동과차에 생우유를 넣은 밀크 음료)', local:'冬瓜牛奶', py:'dōngguā niúnǎi'},
  ],
  tianshi: [

  ],
};

const RESTAURANT_ETC = {
  houdefu: [
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
  gangyuan: [
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
  yaroujen: [
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
  xinglongju: [
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
  laojiang: [
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
  dandan: [
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
  huada: [
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
  dingtaifeng: [
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
  haizhibing: [
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
  zhenglaopai: [
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
  tianshi: [
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
const STATE_KEY = 'taiwan2026_state_v2';
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
    restaurantOrder: { region:'houdefu', food:[], drink:[] },
    expenses: [], // 가계부: 카드 연결(blockId 有) 또는 미분류(blockId 無) 지출 레코드
    meta: { webhookUrl:'', lastSync:'', passport:{attachUrl:'',attachName:'',attachFileId:''}, insurance:{attachUrl:'',attachName:'',attachFileId:''}, medicine:{attachUrl:'',attachName:'',attachFileId:''}, expenseMigratedV1:false }
  };
}
let state = loadJSON(STATE_KEY, null) || defaultState();

/* ---- 마이그레이션: 기존에 저장된 데이터는 절대 지우지 않고, 없는 필드만 채워 넣습니다 ---- */
if(!state.shopping) state.shopping = defaultState().shopping;
if(!state.memos) state.memos = [];
if(!state.restaurantOrder) state.restaurantOrder = { region:'houdefu', food:[], drink:[] };
if(!state.restaurantOrder.food) state.restaurantOrder.food = [];
if(!state.restaurantOrder.drink) state.restaurantOrder.drink = [];
if(!state.restaurantOrder.region) state.restaurantOrder.region = 'houdefu';
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
  if(!menu.length){
    return `<div class="card" id="${sectionId}">
      <div class="section-label">${title}</div>
      <div style="font-size:12.5px; color:var(--muted); padding:6px 2px;">이 식당은 해당 카테고리 메뉴가 없습니다.</div>
    </div>`;
  }
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
      <div style="font-size:12px; color:var(--gold-deep); font-weight:600; margin-top:1px;">${item.en?esc(item.en)+' · ':''}${item.py?esc(item.py)+' · ':''}<span class="font-mono">${esc(item.local)}</span></div>
      ${item.desc?`<div style="font-size:12px; color:var(--ink-2); margin-top:5px; line-height:1.5;">${esc(item.desc)}</div>`:''}
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
  default: {start:'我要點：', end:'，謝謝。'},
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
  const tmpl = ORDER_PHRASE_TEMPLATE[region.id] || ORDER_PHRASE_TEMPLATE.default;
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
