"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation, Save } from "lucide-react";
import { toast } from "sonner";
import type { Customer } from "@/lib/workbench";
import type { PlatformState } from "@/lib/platform";
import {
  nearbyCustomers,
  validLocation,
  distanceKm,
  type CustomerLocation,
} from "@/lib/fieldwork";
type Command = <T = unknown>(data: unknown) => Promise<T>;
type MapAPI = {
  Map: new (
    el: HTMLElement,
    options: unknown,
  ) => {
    add: (markers: unknown[]) => void;
    setFitView: () => void;
    destroy: () => void;
  };
  Marker: new (options: unknown) => {
    on: (name: string, fn: () => void) => void;
  };
};
let mapLoading: Promise<MapAPI> | undefined;
function loadMap(key: string, serviceHost: string): Promise<MapAPI> {
  if (mapLoading) return mapLoading;
  mapLoading = new Promise((resolve, reject) => {
    const w = window as unknown as {
      _AMapSecurityConfig: unknown;
      AMap?: MapAPI;
    };
    w._AMapSecurityConfig = { serviceHost };
    const script = document.createElement("script");
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}`;
    script.async = true;
    const timer = setTimeout(() => {
      mapLoading = undefined;
      script.remove();
      reject(Error("地图加载超时，请使用一键导航"));
    }, 12000);
    script.onload = () => {
      clearTimeout(timer);
      if (w.AMap) resolve(w.AMap);
      else {
        mapLoading = undefined;
        reject(Error("地图服务未就绪，请检查配置"));
      }
    };
    script.onerror = () => {
      clearTimeout(timer);
      mapLoading = undefined;
      script.remove();
      reject(Error("地图暂时无法加载，一键导航仍可使用"));
    };
    document.head.appendChild(script);
  });
  return mapLoading;
}
function EmbeddedMap({
  customers,
  onSelect,
}: {
  customers: Customer[];
  onSelect: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");
  const key = process.env.NEXT_PUBLIC_AMAP_WEB_KEY || "";
  const proxy = process.env.NEXT_PUBLIC_AMAP_SERVICE_HOST || "";
  const ready = !!key && /^https:\/\//.test(proxy);
  useEffect(() => {
    if (!ready || !enabled || !ref.current) return;
    let disposed = false;
    let map: InstanceType<MapAPI["Map"]> | undefined;
    loadMap(key, proxy)
      .then((API) => {
        if (disposed || !ref.current) return;
        map = new API.Map(ref.current, { zoom: 11, viewMode: "2D" });
        const markers = customers
          .filter((c) => validLocation(c.location) && c.location.consent)
          .map((c) => {
            const marker = new API.Marker({
              position: [c.location!.longitude, c.location!.latitude],
              title: "拜访地点",
            });
            marker.on("click", () => onSelect(c.id));
            return marker;
          });
        map.add(markers);
        if (markers.length) map.setFitView();
      })
      .catch((e) => {
        if (!disposed) setError(e.message);
      });
    return () => {
      disposed = true;
      map?.destroy();
    };
  }, [enabled, ready, key, proxy, customers, onSelect]);
  return (
    <div className="field-map-canvas">
      {!ready ? (
        <div className="field-map-empty">
          <MapPin size={30} />
          <strong>高德地图 · 待配置</strong>
          <p>
            登记经营位置后可筛选附近客户、直接导航。地图底图待管理员配置服务
            Key。
          </p>
        </div>
      ) : !enabled ? (
        <div className="field-map-empty">
          <MapPin size={30} />
          <p>加载高德底图，展示已授权的经营地点。</p>
          <button className="btn" onClick={() => setEnabled(true)}>
            加载地图
          </button>
        </div>
      ) : (
        <>
          <div ref={ref} style={{ height: 300, width: "100%" }} />
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
export function CustomerMap({
  state,
  selected,
  onSelect,
  command,
  busy,
}: {
  state: PlatformState;
  selected: Customer;
  onSelect: (id: string) => void;
  command: Command;
  busy: boolean;
}) {
  const [region, setRegion] = useState("");
  const [radius, setRadius] = useState("all");
  const [mode, setMode] = useState<"car" | "walk" | "bus">("car");
  const [editing, setEditing] = useState(false);
  const [fallback, setFallback] = useState("");
  const canEdit = ["admin", "supervisor", "manager"].includes(
    state.workspace.role,
  );
  const regions = [
    ...new Set(
      state.customers
        .map((c) => c.location?.region)
        .filter((x): x is string => !!x),
    ),
  ];
  const anchor = selected.location;
  const list = nearbyCustomers(
    state.customers,
    region,
    anchor,
    radius === "all" ? null : Number(radius),
  );
  const located = list.filter((c) => validLocation(c.location));
  async function navigate(c: Customer) {
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    try {
      const r = await command<{ url: string }>({
        type: "customer.navigate",
        customerId: c.id,
        mode,
      });
      if (tab) tab.location.href = r.url;
      else setFallback(r.url);
    } catch (e) {
      tab?.close();
      toast.error((e as Error).message);
    }
  }
  return (
    <section className="panel field-card field-map">
      <div className="field-card-title">
        <h2>
          <MapPin size={18} />
          企业位置与导航
        </h2>
        <span className="muted-copy">{located.length} 个已登记地点</span>
      </div>
      <div className="field-map-toolbar">
        <label>
          区域
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">全部区域</option>
            {regions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label>
          距当前客户
          <select
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            disabled={!validLocation(anchor)}
          >
            <option value="all">不限距离</option>
            {[1, 3, 5, 10].map((k) => (
              <option key={k} value={k}>
                {k} 公里内
              </option>
            ))}
          </select>
        </label>
        <label>
          出行方式
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
          >
            <option value="car">驾车</option>
            <option value="walk">步行</option>
            <option value="bus">公交</option>
          </select>
        </label>
      </div>
      <EmbeddedMap customers={located} onSelect={onSelect} />
      <p className="micro-copy">
        附近筛选为直线距离，以当前客户经营地点为中心。未登记坐标的客户不参与距离筛选。导航仅传递目的地坐标；手机尝试打开高德
        App，电脑端可补选起点。
      </p>
      <div className="field-map-current">
        <div>
          <strong>
            {selected.id} · {selected.location?.region || "经营位置待登记"}
          </strong>
          <p>
            {selected.location?.address ||
              "请先核实客户经营地址与坐标，系统不会推测位置。"}
          </p>
        </div>
        {canEdit && (
          <button className="text-btn" onClick={() => setEditing(!editing)}>
            {editing ? "收起" : "登记 / 修改位置"}
          </button>
        )}
      </div>
      {editing && (
        <LocationForm
          key={selected.id}
          customer={selected}
          busy={busy}
          onSave={async (location) => {
            await command({
              type: "customer.location",
              customerId: selected.id,
              location,
            });
            setEditing(false);
            toast.success("经营位置已保存");
          }}
        />
      )}
      <div className="field-map-list">
        {located.map((c) => (
          <div key={c.id}>
            <button className="text-btn" onClick={() => onSelect(c.id)}>
              {c.id} · {c.location!.region}
            </button>
            <small>
              {validLocation(anchor)
                ? `${distanceKm(anchor, c.location!).toFixed(1)} km`
                : "已登记坐标"}
            </small>
            {canEdit && (
              <button
                className="btn"
                disabled={busy || !c.location?.consent}
                onClick={() => void navigate(c)}
              >
                <Navigation size={13} />
                一键导航
              </button>
            )}
          </div>
        ))}
        {!located.length && (
          <p className="muted-copy">
            {canEdit
              ? "当前筛选下没有已登记地点，可先为选中客户登记位置。"
              : "当前身份不展示精确经营位置，请由负责客户的展业成员使用地图。"}
          </p>
        )}
      </div>
      {fallback && (
        <a
          className="btn primary"
          href={fallback}
          target="_blank"
          rel="noopener noreferrer"
        >
          浏览器拦截了新窗口，点击打开导航
        </a>
      )}
    </section>
  );
}
function LocationForm({
  customer,
  busy,
  onSave,
}: {
  customer: Customer;
  busy: boolean;
  onSave: (p: CustomerLocation) => Promise<void>;
}) {
  const old = customer.location;
  const [region, setRegion] = useState(old?.region || "");
  const [address, setAddress] = useState(old?.address || "");
  const [lng, setLng] = useState(old ? String(old.longitude) : "");
  const [lat, setLat] = useState(old ? String(old.latitude) : "");
  const [consent, setConsent] = useState(old?.consent || false);
  const [error, setError] = useState("");
  return (
    <form
      className="field-location-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const p: CustomerLocation = {
          region: region.trim(),
          address: address.trim(),
          longitude: Number(lng),
          latitude: Number(lat),
          coordinateSystem: "GCJ02",
          consent,
        };
        if (
          !lng.trim() ||
          !lat.trim() ||
          !p.region ||
          !p.address ||
          !validLocation(p)
        ) {
          setError("请填写有效区域、地址及 GCJ-02 经纬度");
          return;
        }
        try {
          await onSave(p);
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      <label>
        所在区域
        <input
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          maxLength={60}
          required
          placeholder="例如：九江市浔阳区"
        />
      </label>
      <label>
        经营地址
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          maxLength={200}
          required
        />
      </label>
      <div className="two-fields">
        <label>
          经度（GCJ-02）
          <input
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            inputMode="decimal"
            required
          />
        </label>
        <label>
          纬度（GCJ-02）
          <input
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            inputMode="decimal"
            required
          />
        </label>
      </div>
      <p className="micro-copy">
        使用高德坐标拾取器核实坐标；不要直接填写 GPS / 百度坐标。
        <a
          href="https://lbs.amap.com/tools/picker"
          target="_blank"
          rel="noopener noreferrer"
        >
          打开坐标拾取器 ↗
        </a>
      </p>
      <label className="check-label">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        已获授权将该经营位置用于高德地图展示及导航
      </label>
      {error && <p className="error-text">{error}</p>}
      <button className="btn" disabled={busy}>
        <Save size={14} />
        保存位置
      </button>
    </form>
  );
}
