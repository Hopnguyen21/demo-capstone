using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartFarm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddZoneContractsAndDepreciations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
CREATE TABLE IF NOT EXISTS ""ZoneContracts"" (
    ""Id"" uuid NOT NULL PRIMARY KEY,
    ""TenantId"" uuid NOT NULL,
    ""FarmId"" uuid NOT NULL,
    ""ZoneId"" uuid NOT NULL,
    ""CreatedByOwnerId"" uuid NOT NULL,
    ""ParentContractId"" uuid NULL,
    ""ContractNumber"" text NOT NULL,
    ""CropType"" text NULL,
    ""MonthlyRentVnd"" numeric NOT NULL DEFAULT 0,
    ""DepositVnd"" numeric NOT NULL DEFAULT 0,
    ""TotalContractValueVnd"" numeric NOT NULL DEFAULT 0,
    ""StartDate"" date NOT NULL,
    ""EndDate"" date NOT NULL,
    ""Status"" integer NOT NULL DEFAULT 0,
    ""LesseeName"" text NOT NULL,
    ""LesseePhone"" text NULL,
    ""LesseeIdentityNumber"" text NULL,
    ""LesseeAddress"" text NULL,
    ""SpecialTerms"" text NULL,
    ""Notes"" text NULL,
    ""SignedAtUtc"" timestamp with time zone NULL,
    ""TerminatedAtUtc"" timestamp with time zone NULL,
    ""TerminationReason"" text NULL,
    ""CreatedAtUtc"" timestamp with time zone NOT NULL,
    ""UpdatedAtUtc"" timestamp with time zone NULL
);

CREATE TABLE IF NOT EXISTS ""ZoneContractRenewals"" (
    ""Id"" uuid NOT NULL PRIMARY KEY,
    ""ContractId"" uuid NOT NULL,
    ""CreatedByOwnerId"" uuid NOT NULL,
    ""NewEndDate"" date NOT NULL,
    ""NewMonthlyRentVnd"" numeric NULL,
    ""RenewalValueVnd"" numeric NOT NULL DEFAULT 0,
    ""Notes"" text NULL,
    ""CreatedAtUtc"" timestamp with time zone NOT NULL,
    ""UpdatedAtUtc"" timestamp with time zone NULL
);

CREATE TABLE IF NOT EXISTS ""DeviceDepreciations"" (
    ""Id"" uuid NOT NULL PRIMARY KEY,
    ""TenantId"" uuid NOT NULL,
    ""ZoneId"" uuid NOT NULL,
    ""DeviceId"" uuid NOT NULL,
    ""CreatedByOwnerId"" uuid NOT NULL,
    ""OriginalCostVnd"" numeric NOT NULL DEFAULT 0,
    ""MonthlyDepreciationVnd"" numeric NOT NULL DEFAULT 0,
    ""AccumulatedDepreciationVnd"" numeric NOT NULL DEFAULT 0,
    ""CurrentBookValueVnd"" numeric NOT NULL DEFAULT 0,
    ""DepreciationLifetimeMonths"" integer NOT NULL DEFAULT 24,
    ""Method"" text NOT NULL DEFAULT 'STRAIGHT_LINE',
    ""StartDate"" date NOT NULL,
    ""Notes"" text NULL,
    ""CreatedAtUtc"" timestamp with time zone NOT NULL,
    ""UpdatedAtUtc"" timestamp with time zone NULL
);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DROP TABLE IF EXISTS ""DeviceDepreciations"";
DROP TABLE IF EXISTS ""ZoneContractRenewals"";
DROP TABLE IF EXISTS ""ZoneContracts"";
");
        }
    }
}
