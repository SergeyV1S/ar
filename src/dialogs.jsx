import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button, Field, Icon, IconButton, Select, Thumbnail } from './ui.jsx';
import { arrange, dimensions, distance, inspect, normalize, validPolygon } from './geometry.js';
import {
  catalog, checkLabel, decimal, itemSize, materials, modes, money, newId, parseVoice, procurementFields,
  procurementMissing, purchaseIssues, resizeRoom, safeUrl, sourceLabel, types,
} from './data.js';
import { canvasContext } from './plan.js';
import { arHelp } from './ar.js';

const featureTypes = { door: 'Дверь', window: 'Окно', socket: 'Розетка' };
const num = (data, key) => Number(data.get(key));
const text = (data, key) => String(data.get(key) ?? '').trim();

export function Dialog({ title, icon, wide, children, close }) {
  const dialog = useRef(null), onClose = useRef(close);
  onClose.current = close;
  useLayoutEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => { if (node.open) node.close(); };
  }, []);
  return <dialog ref={dialog} className={wide ? 'wide-dialog' : ''} aria-labelledby="dialog-title"
    onCancel={event => { event.preventDefault(); onClose.current(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose.current(); }}>
    <div className="dialog-inner">
      <header className="dialog-head"><div><span className="heading-icon"><Icon name={icon} /></span><h2 id="dialog-title">{title}</h2></div><IconButton icon="close" label="Закрыть" onClick={close} /></header>
      <div className="dialog-body">{children}</div>
    </div>
  </dialog>;
}

function Submit({ children = 'Сохранить', disabled, close, extra = null }) {
  return <div className="form-actions">{extra}<Button onClick={close}>Отмена</Button><button type="submit" className="btn primary" disabled={disabled}><Icon name="check" />{children}</button></div>;
}

function ImagePicker({ onPhoto, label = 'Добавить фото', camera = true }) {
  const [error, setError] = useState('');
  const load = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    let bitmap;
    try {
      if (!file.type.startsWith('image/') || file.size > 24 * 1024 * 1024) throw new Error('Выберите изображение до 24 МБ.');
      bitmap = await createImageBitmap(file);
      const factor = Math.min(1, 740 / Math.max(bitmap.width, bitmap.height));
      const image = document.createElement('canvas');
      image.width = Math.max(1, Math.round(bitmap.width * factor));
      image.height = Math.max(1, Math.round(bitmap.height * factor));
      const ctx = image.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, image.width, image.height);
      ctx.drawImage(bitmap, 0, 0, image.width, image.height);
      onPhoto(image.toDataURL('image/jpeg', .72));
      setError('');
    } catch (failure) { setError(failure.message || 'Не удалось открыть фотографию.'); }
    finally { bitmap?.close(); event.target.value = ''; }
  };
  return <div className="image-picker"><label className="btn file-btn"><Icon name="upload" />{label}<input type="file" accept="image/*" onChange={load} /></label>
    {camera && <label className="btn file-btn"><Icon name="camera" />Камера<input type="file" accept="image/*" capture="environment" onChange={load} /></label>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}

export function RoomEditor({ project, save, close, action }) {
  const [openings, setOpenings] = useState(project.room.openings);
  const [status, setStatus] = useState(project.room.verified);
  const [error, setError] = useState('');
  const extent = dimensions(project.room.points);
  const submit = event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget), width = num(data, 'width'), depth = num(data, 'depth');
    const room = resizeRoom(project.room, width, depth);
    if (!validPolygon(room.points)) { setError('Проверьте размеры стен и площадь комнаты.'); return; }
    for (const opening of openings) {
      const start = room.points[opening.wall], end = room.points[(opening.wall + 1) % room.points.length];
      if (!start || opening.offset + opening.width > distance(start, end) + .005) {
        setError('Проём или розетка выходит за границы стены. Проверьте расстояние от начала стены и ширину.'); return;
      }
    }
    const overlap = openings.some((a, index) => a.type !== 'socket' && openings.slice(index + 1).some(b => b.type !== 'socket' && a.wall === b.wall && a.offset < b.offset + b.width - .01 && b.offset < a.offset + a.width - .01));
    if (overlap) { setError('Два проёма перекрываются на одной стене.'); return; }
    const changed = width !== extent.w || depth !== extent.d || openings !== project.room.openings;
    save({ ...room, name: text(data, 'name') || project.room.name, openings, verified: status, source: changed ? 'manual' : room.source }, num(data, 'passage') / 100);
  };
  const change = (id, patch) => {
    setOpenings(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
    setStatus('review');
  };
  const add = () => {
    setOpenings([...openings, { id: newId(), type: 'door', wall: 0, offset: 0, width: .8, hinge: 'start' }]);
    setStatus('review');
  };
  return <form onSubmit={submit}>
    <div className="inline-actions"><Button icon="scan" className="ar-soft" onClick={() => action('ar-scan')}>AR-обмер</Button><Button icon="camera" onClick={() => action('outline')}>Обвести по фото</Button></div>
    <Field label="Название комнаты"><input name="name" required maxLength={80} defaultValue={project.room.name} /></Field>
    <div className="form-grid three">
      <Field label="Ширина, м"><input type="number" inputMode="decimal" name="width" min=".7" max="35" step=".01" onChange={() => setStatus('review')} defaultValue={extent.w.toFixed(2)} required /></Field>
      <Field label="Глубина, м"><input type="number" inputMode="decimal" name="depth" min=".7" max="35" step=".01" onChange={() => setStatus('review')} defaultValue={extent.d.toFixed(2)} required /></Field>
      <Field label="Мин. проход, см"><input type="number" inputMode="numeric" name="passage" min="45" max="200" defaultValue={Math.round(project.passage * 100)} required /></Field>
    </div>
    <div className="row-title form-section-title"><h3>Двери, окна и розетки</h3><Button icon="plus" onClick={add}>Добавить</Button></div>
    <p className="support-text">Стены идут по порядку от первой точки контура. В прямоугольной комнате первая стена находится сверху на плане.</p>
    {openings.map((opening, index) => <fieldset className="opening" key={opening.id}>
      <legend>{featureTypes[opening.type]} {index + 1}</legend>
      <IconButton icon="trash" label={`Удалить проём ${index + 1}`} className="remove-opening" onClick={() => { setOpenings(openings.filter(item => item.id !== opening.id)); setStatus('review'); }} />
      <div className="form-grid">
        <Field label="Тип"><Select value={opening.type} onChange={e => change(opening.id, { type: e.target.value, width: e.target.value === 'socket' ? .08 : opening.type === 'socket' ? .8 : opening.width })}>{Object.entries(featureTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></Field>
        <Field label="Стена"><Select value={opening.wall} onChange={e => change(opening.id, { wall: Number(e.target.value) })}>{project.room.points.map((_, i) => <option key={i} value={i}>Стена {i + 1}</option>)}</Select></Field>
        <Field label="От начала стены, м"><input type="number" min="0" max="35" step=".01" value={opening.offset} onChange={e => change(opening.id, { offset: e.target.value === '' ? '' : Number(e.target.value) })} required /></Field>
        {opening.type !== 'socket' && <Field label="Ширина проёма, м"><input type="number" min=".2" max="10" step=".01" value={opening.width} onChange={e => change(opening.id, { width: e.target.value === '' ? '' : Number(e.target.value) })} required /></Field>}
        {opening.type === 'door' && <Field label="Петли относительно стены"><Select value={opening.hinge} onChange={e => change(opening.id, { hinge: e.target.value })}><option value="start">Со стороны начала проёма</option><option value="end">Со стороны конца проёма</option></Select></Field>}
      </div>
    </fieldset>)}
    <div className="form-grid section-end"><Field label="Статус размеров"><Select value={status} onChange={e => setStatus(e.target.value)}>{Object.entries(checkLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></Field>
      <div className="field source-field"><span>Источник</span><strong>{sourceLabel[project.room.source]}</strong></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <Submit close={close} />
  </form>;
}

export function Outline({ project, save, close }) {
  const [photo, setPhoto] = useState(''), [points, setPoints] = useState([]), [error, setError] = useState('');
  const canvas = useRef(null);
  const target = useRef([0, 0, 1, 1]);
  useEffect(() => {
    const image = new Image();
    const draw = () => {
      const ctx = canvasContext(canvas.current);
      if (!ctx) return;
      const { c, width, height } = ctx;
      c.clearRect(0, 0, width, height);
      let box = [12, 12, width - 24, height - 24];
      if (photo && image.complete && image.naturalWidth) {
        const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
        const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
        box = [(width - w) / 2, (height - h) / 2, w, h];
        c.drawImage(image, ...box);
      }
      target.current = box;
      const xy = ([x, y]) => [box[0] + x * box[2], box[1] + y * box[3]];
      c.beginPath();
      points.forEach((point, i) => i ? c.lineTo(...xy(point)) : c.moveTo(...xy(point)));
      if (points.length > 2) { c.closePath(); c.fillStyle = '#8659e845'; c.fill(); }
      c.strokeStyle = '#7847e6'; c.lineWidth = 2.6; c.stroke();
      points.forEach((point, i) => {
        const [x, y] = xy(point);
        c.beginPath(); c.arc(x, y, 8, 0, Math.PI * 2);
        c.fillStyle = '#7343e7'; c.fill();
        c.fillStyle = '#fff'; c.font = 'bold 10px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(i + 1, x, y);
      });
    };
    image.onload = draw;
    if (photo) image.src = photo;
    const observer = new ResizeObserver(draw);
    observer.observe(canvas.current);
    draw();
    return () => { observer.disconnect(); image.onload = null; };
  }, [photo, points]);
  const onClick = event => {
    const bounds = event.currentTarget.getBoundingClientRect(), [x, y, w, h] = target.current;
    const p = [(event.clientX - bounds.left - x) / w, (event.clientY - bounds.top - y) / h];
    if (p.some(v => v < 0 || v > 1) || points.length >= 32) return;
    setError('');
    setPoints([...points, p]);
  };
  const submit = event => {
    event.preventDefault();
    if (points.length < 3) { setError('Отметьте не менее трёх углов.'); return; }
    const data = new FormData(event.currentTarget), { w, d } = dimensions(points);
    if (w < .035 || d < .035) { setError('Указанные углы слишком близко друг к другу.'); return; }
    const outline = normalize(points.map(([x, y]) => [x * num(data, 'width') / w, y * num(data, 'depth') / d]));
    if (!validPolygon(outline)) { setError('Обойдите углы по порядку. Линии стен не должны пересекаться.'); return; }
    save({ ...project.room, points: outline, openings: [], source: photo ? 'photo' : 'manual', verified: 'review' }, project.passage);
  };
  const { w, d } = dimensions(project.room.points);
  return <form onSubmit={submit}>
    <p className="support-text">Отмечайте углы по периметру на плане или на фото плана. Укажите фактические размеры по двум осям. Снимок комнаты в перспективе измеряйте в AR.</p>
    <ImagePicker onPhoto={value => { setPhoto(value); setPoints([]); }} label="Загрузить план или фото" />
    <canvas ref={canvas} className="outline-canvas" onClick={onClick} aria-label="Поле ручной разметки углов комнаты" />
    <div className="row-title"><span className="secondary">Углов: {points.length}</span><Button icon="rotate" disabled={!points.length} onClick={() => setPoints(points.slice(0, -1))}>Отменить точку</Button></div>
    <div className="form-grid section-end">
      <Field label="Ширина по контуру, м"><input type="number" name="width" min=".7" max="35" step=".01" required defaultValue={w.toFixed(2)} /></Field>
      <Field label="Глубина по контуру, м"><input type="number" name="depth" min=".7" max="35" step=".01" required defaultValue={d.toFixed(2)} /></Field>
    </div>
    {project.room.openings.length > 0 && <p className="support-text">Укажите проёмы и розетки заново после сохранения нового контура.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <Submit close={close} children="Сохранить контур" />
  </form>;
}

export function ItemEditor({ item, owned, project, save, remove, close }) {
  const [photo, setPhoto] = useState(item?.photo ?? '');
  const [name, setName] = useState(item?.name ?? '');
  const [kind, setKind] = useState(item?.kind ?? 'other');
  const [source, setSource] = useState(item?.source ?? 'manual');
  const [verified, setVerified] = useState(item?.verified ?? 'review');
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(false);
  const [detection, setDetection] = useState({ status: 'idle', matches: [] });
  const scanNumber = useRef(0);
  useEffect(() => () => { scanNumber.current++; }, []);
  const setImage = value => {
    scanNumber.current++;
    setDetection({ status: 'idle', matches: [] });
    setPhoto(value);
    setSource(value ? 'photo' : 'manual');
    setVerified('review');
  };
  const scanImage = async () => {
    const run = ++scanNumber.current;
    setDetection({ status: 'loading', matches: [] });
    try {
      const { identifyFurniture } = await import('./photo.js');
      const matches = await identifyFurniture(photo);
      if (scanNumber.current === run) setDetection({ status: 'ready', matches });
    } catch {
      if (scanNumber.current === run) setDetection({ status: 'error', matches: [] });
    }
  };
  const submit = event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const url = safeUrl(text(data, 'url'));
    if (text(data, 'url') && !url) { setError('Укажите полную ссылку на сайт, начиная с https://.'); return; }
    const width = num(data, 'w') / 100, depth = num(data, 'd') / 100, height = num(data, 'h') / 100;
    const material = text(data, 'material');
    save({ ...item, id: item?.id ?? newId(), owned, mode: item?.mode ?? project.mode,
      name: text(data, 'name'), kind: text(data, 'kind'), w: width, d: depth, h: height,
      material, materials: material === item?.material ? item?.materials : undefined,
      access: num(data, 'access') / 100, price: num(data, 'price'), cap: num(data, 'cap'),
      seller: text(data, 'seller'), sku: text(data, 'sku'), details: text(data, 'details'),
      availability: text(data, 'availability'), url, photo, source, verified });
  };
  const markEdited = () => setVerified('review');
  return <form onSubmit={submit}>
    {item?.illustration && !photo && <div className="item-preview"><Thumbnail item={item} /><p className="support-text">Иллюстрация типа мебели. Фото конкретной модели доступно на сайте продавца.</p></div>}
    {photo && <div className="item-preview"><Thumbnail item={{ photo }} /><Button icon="trash" onClick={() => setImage('')}>Убрать фото</Button></div>}
    <ImagePicker label={photo ? 'Заменить фото' : 'Прикрепить фото'} onPhoto={setImage} />
    {owned && photo && <section className="photo-recognition">
      <Button icon="spark" className="ar-soft" disabled={detection.status === 'loading'} onClick={scanImage}>{detection.status === 'loading' ? 'Анализируем фото…' : 'Распознать мебель'}</Button>
      {detection.status === 'error' && <p className="form-error" role="alert">Не удалось загрузить модель. Проверьте сеть или заполните тип мебели вручную.</p>}
      {detection.status === 'ready' && (detection.matches.length ? <>
        <p className="support-text">Выберите предмет и проверьте предложенный тип. Фактические размеры понадобятся для расстановки.</p>
        <figure className="detection-image"><img src={photo} alt="Загруженная мебель и отмеченные области" />{detection.matches.map(({ box }, i) => <span key={i} style={{ left: `${box[0]}%`, top: `${box[1]}%`, width: `${box[2]}%`, height: `${box[3]}%` }}><b>{i + 1}</b></span>)}</figure>
        <div className="inline-actions">{detection.matches.map(({ title, kind: suggested, score }, i) => <Button key={i} onClick={() => { setName(title); setKind(suggested); setSource('photo'); markEdited(); }}>{i + 1}. {title} · {Math.round(score * 100)}%</Button>)}</div>
      </> : <p className="support-text">Подходящая мебель на фото не обнаружена. Выберите тип вручную.</p>)}
    </section>}
    <Field label="Название"><input name="name" value={name} onChange={e => setName(e.target.value)} maxLength={100} required /></Field>
    <div className="form-grid">
      <Field label="Тип мебели"><Select name="kind" value={kind} onChange={e => { setKind(e.target.value); markEdited(); }}>{Object.entries(types).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></Field>
      <Field label="Материал"><Select name="material" defaultValue={item?.material ?? 'Другое'} onChange={markEdited}>{materials.slice(1).map(value => <option key={value}>{value}</option>)}</Select></Field>
    </div>
    <div className="form-grid three">
      {[[ 'w', 'Ширина, см' ], ['d', 'Глубина, см'], ['h', 'Высота, см']].map(([key, label]) => <Field label={label} key={key}><input name={key} type="number" inputMode="decimal" min="5" max="2000" step=".1" defaultValue={item ? Math.round(item[key] * 1000) / 10 : ''} onChange={markEdited} required /></Field>)}
    </div>
    <Field label="Запас перед фасадом, см" hint="Место для выдвижения ящиков и открывания дверец. Оставьте 0, если запас не нужен."><input name="access" type="number" min="0" max="400" defaultValue={Math.round((item?.access ?? 0) * 100)} onChange={markEdited} /></Field>
    {!owned && <>
      <div className="form-grid"><Field label="Цена, ₽"><input name="price" type="number" min="0" max="1000000000" defaultValue={item?.price} required onChange={markEdited} /></Field><Field label="Лимит позиции, ₽"><input name="cap" type="number" min="0" max="1000000000" defaultValue={item?.cap || ''} placeholder="Без лимита" /></Field></div>
      <div className="form-grid"><Field label={project.mode === 'office' ? 'Поставщик' : 'Магазин или продавец'}><input name="seller" defaultValue={item?.seller} maxLength={120} required={project.mode === 'office'} /></Field><Field label="Артикул"><input name="sku" defaultValue={item?.sku} maxLength={120} /></Field></div>
      <Field label="Ссылка на товар, объявление или КП"><input name="url" type="url" defaultValue={item?.url} /></Field>
      <Field label="Наличие"><input name="availability" defaultValue={item?.availability} placeholder="Уточнить у продавца" maxLength={200} /></Field>
      {project.mode === 'office' && <Field label="Реквизиты поставщика" hint="Наименование юрлица, ИНН и другие данные для вашей сметы."><textarea name="details" defaultValue={item?.details} maxLength={500} required /></Field>}
    </>}
    <div className="form-grid"><Field label="Источник"><Select value={source} onChange={e => setSource(e.target.value)}>{Object.entries(sourceLabel).filter(([key]) => ['manual', 'photo', 'catalog', 'voice', 'import'].includes(key)).map(([key, value]) => <option value={key} key={key}>{value}</option>)}</Select></Field>
    <Field label="Статус проверки"><Select value={verified} onChange={e => setVerified(e.target.value)}>{Object.entries(checkLabel).map(([key, value]) => <option value={key} key={key}>{value}</option>)}</Select></Field></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <Submit close={close} extra={item && <Button icon="trash" className="danger push-left" onClick={() => removing ? remove(item.id) : setRemoving(true)}>{removing ? 'Подтвердить удаление' : 'Удалить'}</Button>} />
  </form>;
}

export function Voice({ project, apply }) {
  const [phrase, setPhrase] = useState(''), [listening, setListening] = useState(false), [message, setMessage] = useState('');
  const recognition = useRef(null);
  const browserRecognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  const { patch, notes } = parseVoice(phrase, project);
  useEffect(() => () => {
    if (recognition.current) {
      recognition.current.onresult = null;
      recognition.current.onerror = null;
      recognition.current.onend = null;
      recognition.current.abort();
    }
  }, []);
  const speak = () => {
    if (listening) { recognition.current.stop(); return; }
    if (!browserRecognition) return;
    try {
      const session = new browserRecognition();
      recognition.current = session;
      session.lang = 'ru-RU'; session.interimResults = true; session.continuous = false;
      session.onresult = event => setPhrase(Array.from(event.results).map(result => result[0].transcript).join(' '));
      session.onerror = event => setMessage(event.error === 'not-allowed' ? 'Микрофон недоступен. Введите фразу в поле ниже.' : 'Распознавание прервалось. Проверьте сеть или введите фразу.');
      session.onend = () => { setListening(false); recognition.current = null; };
      session.start();
      setMessage('');
      setListening(true);
    } catch { setMessage('Не удалось включить микрофон. Введите фразу вручную.'); }
  };
  return <>
    <p className="support-text">Например: «Комната 4 на 3, диван 2 метра, бюджет 80 тысяч, материал ЛДСП».</p>
    {browserRecognition ? <Button icon="mic" className="ar-soft" onClick={speak}>{listening ? 'Остановить запись' : 'Говорить'}</Button> : <p className="notice">Браузер не поддерживает распознавание речи. Можно ввести текст или использовать диктовку клавиатуры.</p>}
    <Field className="section-end" label="Размеры и пожелания"><textarea rows={4} value={phrase} onChange={event => setPhrase(event.target.value)} placeholder="Комната 4 на 3…" /></Field>
    {message && <p className="form-error" role="alert">{message}</p>}
    {notes.length > 0 ? <div className="check-list">{notes.map(note => <div key={note}><Icon name="checkCircle" size={17} />{note}</div>)}</div>
      : phrase.trim() && <p className="support-text">Попробуйте указать комнату, размеры дивана или бюджет цифрами.</p>}
    <div className="form-actions"><Button icon="check" className="primary" disabled={!notes.length || listening} onClick={() => apply(patch)}>Проверено, применить</Button></div>
  </>;
}

export function Catalog({ project, items, positions, add, action }) {
  const [fitOnly, setFitOnly] = useState(true);
  const total = items.reduce((sum, item) => sum + item.price, 0);
  const external = project.mode === 'used';
  if (project.mode !== 'retail') return <>
    <p className="notice">{external ? 'Откройте поиск объявлений, затем добавьте ссылку, цену и габариты выбранной мебели.' : 'Добавьте предложения поставщиков и заполните поля закупки. Для автоматического получения КП и проверки поставщиков требуется интеграция.'}</p>
    <div className="inline-actions">{external && <a className="btn" href="https://www.avito.ru/rossiya/mebel_i_interer" target="_blank" rel="noreferrer"><Icon name="external" />Поиск на Авито</a>}
      <Button icon="plus" className="primary" onClick={() => action('add-buy')}>{external ? 'Добавить объявление' : 'Добавить предложение'}</Button>
      {!external && <Button icon="receipt" onClick={() => action('procurement')}>Поля закупки</Button>}</div>
  </>;
  const offers = catalog.map(item => {
    const included = items.some(existing => existing.id === item.id);
    const proposed = included ? null : [...project.items.filter(entry => entry.owned), ...items, item];
    const fitsLayout = proposed ? [0, 1, 2].some(variant => {
      const arrangement = arrange(project.room, proposed, variant);
      return arrangement[item.id] && !inspect(project.room, proposed, arrangement, project.passage).warnings.length;
    }) : Boolean(positions[item.id]);
    const problems = [...purchaseIssues(project, item)];
    if (!fitsLayout) problems.push('Проверьте место на плане');
    if ((!included ? total + item.price : total) > project.budget) problems.push('Сверх общего бюджета');
    return { item, included, problems };
  }).filter(({ included, problems }) => !fitOnly || included || problems.length === 0);
  return <>
    <div className="catalog-tools"><p className="support-text">Подбор по материалу, габаритам и остаткам бюджета. Цена и доставка зависят от региона и даты проверки.</p>
      <label className="check-field"><input type="checkbox" checked={fitOnly} onChange={e => setFitOnly(e.target.checked)} />Показывать подходящие и уже добавленные</label></div>
    <div className="catalog-grid">{offers.map(({ item, included, problems }) => <article className="catalog-card" key={item.id}>
      <Thumbnail item={item} />
      <div className="catalog-card-body"><h3>{item.name}</h3><p>{item.seller} · {itemSize(item)} · {item.material}</p><p>{item.availability}</p>
        <strong>{money(item.price)}</strong>
        {problems.length > 0 && <p className="form-error">{problems.join(' · ')}</p>}
        <div className="inline-actions"><Button icon={included ? 'pencil' : 'plus'} className={included ? '' : 'primary'} onClick={() => included ? action('item', item.id) : add(item)}>{included ? 'На плане' : 'Добавить'}</Button>
        <a className="icon-btn" aria-label={`Открыть ${item.name} у продавца`} href={item.url} target="_blank" rel="noreferrer"><Icon name="external" /></a></div></div>
    </article>)}</div>
    {!offers.length && <p className="empty-small">Подходящих товаров в наборе нет. Отключите фильтр или внесите товар вручную.</p>}
    <div className="form-actions"><Button icon="plus" onClick={() => action('add-buy')}>Внести товар вручную</Button></div>
  </>;
}

export function EstimateContent({ project, items, inspection, positions, print = false }) {
  const total = items.reduce((sum, item) => sum + item.price, 0), difference = project.budget - total;
  const office = project.mode === 'office';
  let balance = project.budget;
  return <>
    <div className="estimate-totals"><div><span>Бюджет</span><strong>{money(project.budget)}</strong></div><div><span>К покупке</span><strong>{money(total)}</strong></div><div><span>{difference >= 0 ? 'Остаток' : 'Превышение'}</span><strong className={difference < 0 ? 'form-error' : ''}>{money(Math.abs(difference))}</strong></div></div>
    <div className="table-wrap"><table><thead><tr><th>Позиция</th><th>Продавец</th><th>Размеры</th><th>Цена</th><th>Проверка</th></tr></thead>
      <tbody>{items.map(item => {
        const issues = purchaseIssues(project, item);
        if (!positions[item.id]) issues.push('Не размещено');
        if (item.price > balance) issues.push('За пределами бюджета');
        else if (!issues.length) balance -= item.price;
        return <tr key={item.id}><td><strong>{item.name}</strong><small>{item.material}{item.sku && ` · ${item.sku}`}</small></td><td>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.seller || 'Ссылка на товар'}</a> : item.seller || '—'}{item.details && <small>{item.details}</small>}</td>
          <td>{itemSize(item)}</td><td>{money(item.price)}</td><td><span className={issues.length ? 'form-error' : ''}>{issues.length ? issues.join(', ') : 'В пределах лимитов'}</span><small>{sourceLabel[item.source]} · {checkLabel[item.verified]}{item.availability && ` · ${item.availability}`}</small></td></tr>;
      })}{!items.length && <tr><td colSpan="5">Пока нет позиций к покупке.</td></tr>}</tbody></table></div>
    {office && <div className="procurement-summary"><h3>Данные служебной закупки</h3>
      {Object.entries(procurementFields).map(([key, value]) => <p key={key}><strong>{value}</strong> {key === 'offer' && safeUrl(project.procurement[key]) ? <a href={project.procurement[key]} rel="noreferrer" target="_blank">{project.procurement[key]}</a> : project.procurement[key] || '—'}</p>)}</div>}
    {print && inspection.warnings.map((warning, i) => <p className="form-error" key={i}>{warning.message}</p>)}
  </>;
}

export function Procurement({ project, save, close }) {
  return <form onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    save(Object.fromEntries(Object.keys(procurementFields).map(key => [key, text(data, key)])));
  }}>
    {Object.entries(procurementFields).map(([key, label]) => <Field key={key} label={label}>
      {key === 'reason' ? <textarea required name={key} rows={3} maxLength={1500} defaultValue={project.procurement[key]} />
        : <input required name={key} type={key === 'offer' ? 'url' : 'text'} pattern={key === 'offer' ? 'https?://.+' : undefined} maxLength={1500} defaultValue={project.procurement[key]} />}
    </Field>)}
    <Submit close={close} />
  </form>;
}

export function ExportOptions({ project, action, run }) {
  const missing = project.mode === 'office' ? procurementMissing(project) : [];
  return <>
    {missing.length > 0 && <div className="notice"><p>Для служебной сметы заполните поля проекта и реквизиты поставщиков.</p><ul>{missing.map(value => <li key={value}>{value}</li>)}</ul><Button icon="receipt" onClick={() => action('procurement')}>Поля закупки</Button></div>}
    <div className="option-list">
      <button disabled={missing.length > 0} onClick={() => run('pdf')}><Icon name="printer" /><span><strong>План и смета в PDF</strong><small>Печать или сохранение в PDF через браузер</small></span></button>
      <button disabled={missing.length > 0} onClick={() => run('csv')}><Icon name="receipt" /><span><strong>Таблица закупки в CSV</strong><small>Позиции, цены, габариты и поставщики</small></span></button>
      <button onClick={() => run('json')}><Icon name="download" /><span><strong>Скачать данные проекта</strong><small>Файл JSON для переноса на другое устройство</small></span></button>
    </div>
  </>;
}

export function CheckReport({ project, inspection, action }) {
  return <>
    <div className="check-list">
      <div><Icon name={inspection.state === 'ok' ? 'checkCircle' : 'info'} />{inspection.state === 'ok' ? `От двери до центра комнаты проходит маршрут шириной ${Math.round(project.passage * 100)} см.` : inspection.state === 'no-door' ? 'Добавьте дверь, чтобы проверить маршрут прохода.' : 'Переместите мебель или попробуйте другой вариант расстановки.'}</div>
      {inspection.warnings.map(({ message }, index) => <div className="warning-text" key={index}><Icon name="alert" />{message}</div>)}
      {inspection.warnings.length === 0 && <div><Icon name="checkCircle" />Пересечений мебели, стен и зон открывания нет.</div>}
    </div>
    <p className="support-text">Вариант «{variants[project.variant].title}». Проверка основана на размерах и проёмах в проекте.</p>
    <div className="form-actions"><Button icon="pencil" onClick={() => action('room')}>Настроить комнату</Button></div>
  </>;
}

export function ARHelp({ mode, support, error, back, launch }) {
  const scan = mode === 'scan';
  return <>
    <p className="support-text">{scan ? 'Наведите камеру на пол и отметьте углы комнаты последовательно. Затем можно отметить края проёмов и розетки. Габариты будут рассчитаны по измеренным точкам.' : 'Отметьте на полу начало плана и направление верхней стены. Расставленная мебель появится в масштабе 1:1. Для перестановки модели отметьте точки заново.'}</p>
    <div className="notice"><Icon name="info" />{support === true ? 'Разрешите камеру, когда браузер попросит доступ.' : support === null ? 'Проверяем поддержку дополненной реальности…' : arHelp}</div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions">{scan ? <Button icon="camera" onClick={back}>Ручная разметка</Button> : <Button onClick={back}>Вернуться к плану</Button>}
      <Button className="primary" icon={scan ? 'scan' : 'cube'} disabled={support !== true} onClick={launch}>{scan ? 'Запустить обмер' : 'Запустить AR-просмотр'}</Button></div>
  </>;
}
