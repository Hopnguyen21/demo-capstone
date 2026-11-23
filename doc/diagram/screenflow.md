# Trang-1

Source: `screenflow.drawio`.

````mermaid
flowchart LR
    %% Định nghĩa kiểu dáng màu sắc theo hình gốc
    classDef yellow fill:#fff2cc,stroke:#d6b656,stroke-width:1px,color:#000000;
    classDef white fill:#ffffff,stroke:#333333,stroke-width:1px,color:#000000;
    classDef rounded fill:#ffffff,stroke:#333333,stroke-width:1px,rx:15,ry:15,color:#000000;

    %% Luồng chính từ Home Page
    Home["Home Page"]:::yellow --> Login["User Login"]:::yellow

    Login --> Register["User Register"]:::yellow
    Login --> ResetPass["Reset Password"]:::yellow
    Login --> PostLogin["PostLogin"]:::white

    %% Danh sách các tính năng từ PostLogin
    PostLogin --> Profile["User Profile"]:::yellow
    Profile --> ChangePass["Change Password"]:::yellow

    PostLogin --> FarmsList["Farms List"]:::white
    FarmsList --> CreateFarm(["Create Farm Wizard"]):::rounded
    
    %% Subgraph Farm Details
    subgraph FarmDetails["Farm Details"]
        Fields["Fields Info"]:::white
        Zones["Zones Info"]:::white
    end
    FarmsList --> FarmDetails

    PostLogin --> Seasons["Seasons List"]:::white
    Seasons --> SeasonDetails["Season Details"]:::white

    PostLogin --> Monitoring["Monitoring Realtime"]:::white
    Monitoring --> Charts["Historical Charts"]:::white

    PostLogin --> GISMap["Farm GIS Map"]:::white
    GISMap --> NodeMapper(["Zone Node Mapper"]):::rounded

    PostLogin --> Actuator["Actuator Control"]:::white
    Actuator --> SafetyRules(["Safety Interlock Rules"]):::rounded

    PostLogin --> Schedules["Schedules List"]:::white
    Schedules --> RuleDetails["Rule Details"]:::white

    PostLogin --> Tasks["Tasks List"]:::white
    Tasks --> TaskDetails(["Task Details"]):::rounded

    PostLogin --> Alerts["Alerts List"]:::white
    PostLogin --> Inventory["Inventory List"]:::white
    PostLogin --> AIAssistant["AI Assistant"]:::white
    PostLogin --> Reports["Reports & Analytics"]:::white

    PostLogin --> Tenants["Tenants List"]:::white
    Tenants --> TenantDetails["Tenant Details"]:::white

    PostLogin --> Users["Users List"]:::white
    Users --> UserDetails["User Details"]:::white

    PostLogin --> Crops["Crops List"]:::white
    Crops --> CropDetails["Crop Details"]:::white

    PostLogin --> Provisioning["Provisioning List"]:::white
    Provisioning --> DeviceDetails["Device Details"]:::white

    PostLogin --> Maintenance["Maintenance List"]:::white
    Maintenance --> TicketDetails["Ticket Details"]:::white
````
