const histories = {
  pressure: [182, 188, 184, 196, 192, 201, 198, 206, 202, 210, 205, 208],
  load: [75, 77, 73, 79, 82, 78, 81, 84, 82, 85, 84, 86],
  rpm: [110, 112, 116, 113, 118, 120, 117, 121, 118, 120, 122, 120],
  temperature: [55, 56, 55, 58, 57, 59, 58, 60, 59, 61, 60, 62],
};

export function seedDemo(db) {
  const now = new Date();
  const rows = [
    [
      "rig-101",
      "RIG-101",
      "RIG",
      "operativo",
      "Loma Campana",
      "Operadora del Sur",
      "LC-1042(h)",
      -38.444,
      -68.578,
      1,
    ],
    [
      "rig-204",
      "RIG-204",
      "RIG",
      "atencion",
      "La Amarga Chica",
      "Energía Patagónica",
      "LAC-2085(h)",
      -38.328,
      -68.764,
      2,
    ],
    [
      "wo-302",
      "WO-302",
      "WORKOVER",
      "operativo",
      "Bandurria Sur",
      "Operadora del Sur",
      "BS-3091",
      -38.558,
      -68.694,
      3,
    ],
    [
      "wo-415",
      "WO-415",
      "WORKOVER",
      "operativo",
      "Añelo",
      "Andes Energy",
      "AN-4150",
      -38.354,
      -68.797,
      1,
    ],
    [
      "pl-508",
      "PL-508",
      "PULLING",
      "atencion",
      "Bajo del Choique",
      "Energía Patagónica",
      "BC-5082",
      -38.109,
      -69.03,
      2,
    ],
    [
      "pl-612",
      "PL-612",
      "PULLING",
      "desconectado",
      "Aguada Pichana",
      "Andes Energy",
      "AP-6124",
      -38.461,
      -69.227,
      3,
    ],
  ];
  const addTower = db.prepare("INSERT INTO towers (id, data) VALUES (?, ?)");
  for (const [
    id,
    name,
    type,
    status,
    location,
    operator,
    well,
    lat,
    lng,
    imageNumber,
  ] of rows) {
    const disconnected = status === "desconectado";
    const parameters = [
      {
        key: "pressure",
        label: "Presión de bombeo",
        value: 208,
        unit: "bar",
        min: 0,
        max: 350,
        history: histories.pressure,
      },
      {
        key: "load",
        label: "Carga en gancho",
        value: type === "RIG" ? 86 : 42,
        unit: "t",
        min: 0,
        max: type === "RIG" ? 150 : 80,
        history: histories.load.map((v) =>
          type === "RIG" ? v : Math.round(v / 2),
        ),
      },
      {
        key: "rpm",
        label: "Velocidad de rotación",
        value: type === "PULLING" ? 0 : 120,
        unit: "rpm",
        min: 0,
        max: 200,
        history: type === "PULLING" ? Array(12).fill(0) : histories.rpm,
      },
      {
        key: "temperature",
        label: "Temperatura del motor",
        value: id === "rig-204" ? 94 : 62,
        unit: "°C",
        min: 0,
        max: 90,
        history:
          id === "rig-204"
            ? [72, 74, 76, 79, 80, 82, 85, 87, 88, 90, 92, 94]
            : histories.temperature,
      },
    ];
    const tower = {
      id,
      name,
      type,
      status,
      location,
      operator,
      well,
      lat,
      lng,
      image: `/assets/rig-${imageNumber}.jpg`,
      updatedAt: new Date(
        now.getTime() - (disconnected ? 7200000 : 300000),
      ).toISOString(),
      cameras: ["Piso de perforación", "Vista general", "Zona de bombas"].map(
        (name, index) => ({
          id: `${id}-cam-${index + 1}`,
          name,
          kind: "demo",
          url: `/assets/rig-${((imageNumber + index - 1) % 3) + 1}.jpg`,
          status: disconnected ? "offline" : "online",
        }),
      ),
      parameters,
      demo: true,
    };
    addTower.run(id, JSON.stringify(tower));
  }
  const rowsAnomalies = [
    [
      "anm-1001",
      "rig-204",
      "Temperatura de motor elevada",
      "Lectura de ejemplo de 94 °C, por encima del umbral de referencia de 90 °C. Verificar refrigeración antes de continuar la operación.",
      "critica",
      "pendiente",
      18,
      2,
      "Zona de bombas",
    ],
    [
      "anm-1002",
      "pl-508",
      "Persona en zona de maniobra",
      "Detección ilustrativa de presencia en el perímetro de maniobra. Revisar la imagen y validar con el supervisor del equipo.",
      "critica",
      "pendiente",
      42,
      3,
      "Vista general",
    ],
    [
      "anm-1003",
      "rig-101",
      "Verificación de elementos de protección",
      "Evento de demostración para revisar el uso de elementos de protección personal en el piso de perforación.",
      "media",
      "pendiente",
      86,
      1,
      "Piso de perforación",
    ],
    [
      "anm-1004",
      "wo-302",
      "Obstrucción parcial de cámara",
      "La imagen de ejemplo presenta visibilidad limitada. Revisar el campo visual y el estado de la lente.",
      "baja",
      "revisada",
      180,
      3,
      "Vista general",
    ],
    [
      "anm-1005",
      "wo-415",
      "Inspección de orden y limpieza",
      "Registro ilustrativo de inspección del área de bombas. Se documentó la revisión del supervisor.",
      "media",
      "resuelta",
      360,
      2,
      "Zona de bombas",
    ],
  ];
  const addAnomaly = db.prepare(
    "INSERT INTO anomalies (id, tower_id, data) VALUES (?, ?, ?)",
  );
  for (const [
    id,
    towerId,
    title,
    description,
    severity,
    status,
    minutesAgo,
    imageNumber,
    camera,
  ] of rowsAnomalies) {
    const anomaly = {
      id,
      towerId,
      title,
      description,
      severity,
      status,
      timestamp: new Date(now.getTime() - minutesAgo * 60000).toISOString(),
      image: `/assets/rig-${imageNumber}.jpg`,
      camera,
    };
    addAnomaly.run(id, towerId, JSON.stringify(anomaly));
  }
}
