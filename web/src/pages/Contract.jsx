import { Link, useParams } from "react-router-dom";
import { money, day } from "../format.js";
import { Icon, Empty, useApi } from "../components/ui.jsx";

// Договор-заявка на перевозку, собранная из данных рейса. Печать / сохранение в PDF — средствами браузера.
export default function Contract() {
  const { code } = useParams();
  const { data: c, error } = useApi(`/cargos/${code}`);
  if (error) return <Empty title="Груз не найден">{error.message}</Empty>;
  if (!c) return <Empty title="Загружаем…" />;
  const today = new Date().toLocaleDateString("ru-RU");

  return (
    <>
      <div className="row no-print">
        <Link to={`/cargos/${code}`} className="btn btn-ghost"><Icon name="arrowLeft" />К грузу</Link>
        <button className="btn btn-primary" onClick={() => window.print()}><Icon name="file" />Печать / сохранить PDF</button>
        <span className="xs muted">Подпись ЭЦП и отправка через ЭДО появятся после подключения NCALayer</span>
      </div>
      <article className="doc card">
        <h1>ДОГОВОР-ЗАЯВКА № {c.code} на перевозку груза</h1>
        <p style={{ textAlign: "right" }}>от {today}</p>
        <table><tbody>
          <tr><td>Заказчик</td><td>{c.logist_company ?? "—"}, в лице {c.logist_name}, тел. {c.logist_phone}</td></tr>
          <tr><td>Перевозчик</td><td>{c.driver_name ?? "—"}{c.driver_phone ? `, тел. ${c.driver_phone}` : ""}</td></tr>
          <tr><td>Транспортное средство</td><td>{[c.driver_vehicle, c.driver_body, c.driver_capacity && `${c.driver_capacity} т`, c.driver_plate && `гос. номер ${c.driver_plate}`].filter(Boolean).join(", ") || "—"}</td></tr>
          <tr><td>Маршрут</td><td>{c.from_city} — {c.to_city}{c.distance_km ? ` (~${c.distance_km} км)` : ""}</td></tr>
          <tr><td>Дата загрузки</td><td>{day(c.load_date)} ({c.load_date})</td></tr>
          <tr><td>Груз</td><td>{c.kind ?? "—"}, {c.weight} т{c.volume ? `, ${c.volume} м³` : ""}</td></tr>
          <tr><td>Тип кузова</td><td>{c.body}</td></tr>
          <tr><td>Особые условия</td><td>{c.notes ?? "—"}</td></tr>
          <tr><td>Стоимость перевозки</td><td><strong>{money(c.price)}</strong>, без НДС. Оплата в течение 5 банковских дней после доставки и получения оригиналов документов.</td></tr>
        </tbody></table>
        <p>Перевозчик обязуется подать исправное транспортное средство в указанную дату, обеспечить сохранность груза и доставку в пункт назначения. Заказчик обязуется оплатить перевозку на условиях настоящей заявки.</p>
        <table><tbody>
          <tr><td>Заказчик: ____________________ / {c.logist_name} /</td><td>Перевозчик: ____________________ / {c.driver_name ?? ""} /</td></tr>
        </tbody></table>
      </article>
    </>
  );
}
